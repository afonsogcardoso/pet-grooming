import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import compression from 'compression'
import { createClient } from '@supabase/supabase-js'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { apiKeyAuth } from './apiKeyAuth.js'
import appointmentsRouter from './routes/appointments.js'
import customersRouter from './routes/customers.js'
import servicesRouter from './routes/services.js'
import authRouter from './routes/auth.js'
import brandingRouter from './routes/branding.js'
import domainsRouter from './routes/domains.js'
import profileRouter from './routes/profile.js'
import notificationsRouter from './routes/notifications.js'
import adminRouter from './routes/admin.js'
import publicRouter from './routes/public.js'
import accountMembersRouter from './routes/accountMembers.js'
import marketplaceRouter from './routes/marketplace.js'
import petAttributesRouter from './routes/petAttributes.js'

const envResult = dotenv.config({ path: '.env.local' })
if (envResult.error) {
  dotenv.config()
}

const app = express()

// Lightweight request timing to surface latency in Vercel logs and response headers
app.use((req, res, next) => {
  const start = process.hrtime.bigint()
  let headersSent = false

  const origWriteHead = res.writeHead
  res.writeHead = function (...args) {
    if (!headersSent) {
      const durMs = Number(process.hrtime.bigint() - start) / 1e6
      res.setHeader('Server-Timing', `total;dur=${durMs.toFixed(1)}`)
      res.setHeader('X-Response-Time', `${durMs.toFixed(1)}ms`)
      headersSent = true
    }
    return origWriteHead.apply(this, args)
  }

  res.on('finish', () => {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6
    console.log('[perf]', JSON.stringify({ path: req.originalUrl, method: req.method, status: res.statusCode, durMs: Number(durMs.toFixed(1)) }))
  })

  next()
})

const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(',').map((entry) => entry.trim()).filter(Boolean) || []
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const corsDomainCacheSeconds = Number(process.env.CORS_DOMAIN_CACHE_SECONDS || 300)
const corsCache = new Map()

const supabaseAdmin =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    : null

function cacheDomain(hostname, allowed) {
  if (!hostname) return
  const ttl = corsDomainCacheSeconds > 0 ? corsDomainCacheSeconds * 1000 : 0
  const expiresAt = ttl > 0 ? Date.now() + ttl : Date.now()
  corsCache.set(hostname, { allowed, expiresAt })
}

function readCachedDomain(hostname) {
  const entry = corsCache.get(hostname)
  if (!entry) return null
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    corsCache.delete(hostname)
    return null
  }
  return entry.allowed
}

async function isDomainAllowedInDb(hostname) {
  if (!supabaseAdmin || !hostname) return false

  const cached = readCachedDomain(hostname)
  if (cached !== null) {
    return cached
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('custom_domains')
      .select('id')
      .eq('domain', hostname)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      cacheDomain(hostname, false)
      return false
    }

    const allowed = Boolean(data)
    cacheDomain(hostname, allowed)
    return allowed
  } catch {
    cacheDomain(hostname, false)
    return false
  }
}

function matchesAllowedList(origin) {
  // Allow everything if '*' is configured (useful for tunnels/dev)
  if (allowedOrigins.includes('*')) return true
  if (!origin) return true

  let hostname = ''
  try {
    hostname = new URL(origin).hostname
  } catch {
    hostname = origin
  }

  return allowedOrigins.some((entry) => {
    if (!entry) return false
    if (entry.startsWith('*.')) {
      // Wildcard subdomains: *.example.com matches foo.example.com
      const suffix = entry.slice(1)
      return hostname.endsWith(suffix)
    }
    return entry === origin || entry === hostname
  })
}

async function isOriginAllowed(origin) {
  if (matchesAllowedList(origin)) {
    return true
  }

  let hostname = ''
  try {
    hostname = new URL(origin).hostname
  } catch {
    hostname = origin
  }

  return isDomainAllowedInDb(hostname)
}

app.use(
  cors({
    origin: async (origin, callback) => {
      try {
        const allowed = await isOriginAllowed(origin)
        if (allowed) {
          return callback(null, true)
        }
        return callback(new Error('Not allowed by CORS'))
      } catch (error) {
        return callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
  })
)

app.use(compression())
app.use(express.json())
app.use(apiKeyAuth)

// Resolve tenant from bearer token if accountId not already set (e.g., from API key)
app.use(async (req, _res, next) => {
  if (req.accountId || !supabaseAdmin) return next()
  const auth = req.headers.authorization || ''
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null
  if (!token) return next()
  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !userData?.user?.id) return next()
    const userId = userData.user.id
    const { data: membership } = await supabaseAdmin
      .from('account_members')
      .select('account_id')
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (membership?.account_id) {
      req.accountId = membership.account_id
    }
  } catch (err) {
    console.error('[account-resolver] error', err)
  }
  return next()
})

// OpenAPI / Swagger setup (served at /docs and /docs.json)
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Pawmi API',
    version: '1.0.0',
    description: 'Endpoints for appointments, customers and services'
  },
  tags: [
    { name: 'Auth', description: 'Authentication and session' },
    { name: 'Profile', description: 'Profile and membership' },
    { name: 'Appointments', description: 'Appointments lifecycle' },
    { name: 'Customers', description: 'Customers and their pets' },
    { name: 'Services', description: 'Service catalog' },
    { name: 'Branding', description: 'Branding/theme per tenant' },
    { name: 'Marketplace', description: 'Marketplace discovery and requests' }
  ],
  servers: [
    {
      url: `${(process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '')}/api/v1`
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key'
      },
      SupabaseBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token de sessão obtido no /auth/login (Authorization: Bearer {token})'
      }
    },
    schemas: {
      AuthLoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', format: 'password' }
        }
      },
      AuthLoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'access_token do Supabase' },
          refreshToken: { type: 'string' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string', nullable: true }
        }
      },
      AuthRefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      },
      UserProfile: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          phoneCountryCode: { type: 'string', nullable: true, example: '+351' },
          phoneNumber: { type: 'string', nullable: true, example: '912345678' },
          locale: { type: 'string', nullable: true, example: 'pt' },
          avatarUrl: { type: 'string', nullable: true },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time', nullable: true }
        }
      },
      Appointment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          appointment_date: { type: 'string', format: 'date' },
          appointment_time: { type: 'string', example: '14:30' },
          duration: { type: 'integer' },
          payment_status: { type: 'string', enum: ['paid', 'unpaid'] },
          status: { type: 'string' },
          customers: { type: 'object' },
          services: { type: 'object' },
          pets: { type: 'object' }
        }
      },
      Customer: {
        type: 'object',
        required: ['firstName', 'lastName'],
        properties: {
          id: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          phone: { type: 'string' },
          phoneCountryCode: { type: 'string', nullable: true },
          phoneNumber: { type: 'string', nullable: true },
          address: { type: 'string' },
          address2: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          nif: { type: 'string', nullable: true }
        }
      },
      Service: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          default_duration: { type: 'integer' },
          price: { type: 'number' },
          active: { type: 'boolean' },
          description: { type: 'string' },
          image_url: { type: 'string', nullable: true }
        }
      }
    }
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Autenticar utilizador',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthLoginRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Token de sessão',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthLoginResponse' }
              }
            }
          },
          401: { description: 'Credenciais inválidas' }
        }
      }
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Obter novo access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthRefreshRequest' }
            }
          }
        },
        responses: {
          200: {
            description: 'Novo token de sessão',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthLoginResponse' }
              }
            }
          },
          401: { description: 'Refresh inválido' }
        }
      }
    },
    '/profile': {
      get: {
        tags: ['Profile'],
        summary: 'Perfil do utilizador autenticado',
        security: [{ SupabaseBearer: [] }],
        responses: {
          200: {
            description: 'Perfil',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserProfile' }
              }
            }
          },
          401: { description: 'Não autenticado' }
        }
      }
    },
    '/appointments': {
      get: {
        tags: ['Appointments'],
        summary: 'List appointments',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          {
            in: 'query',
            name: 'date_from',
            schema: { type: 'string', format: 'date' },
            description: 'Filtra a partir desta data (YYYY-MM-DD)'
          },
          {
            in: 'query',
            name: 'date_to',
            schema: { type: 'string', format: 'date' },
            description: 'Filtra até esta data (YYYY-MM-DD)'
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string' },
            description: 'Filtra por status'
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
            description: 'Limite de resultados'
          },
          {
            in: 'query',
            name: 'offset',
            schema: { type: 'integer', minimum: 0, default: 0 },
            description: 'Offset para paginação (skip)'
          }
        ],
        responses: {
          200: {
            description: 'Array of appointments',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Appointment' }
                    },
                    meta: {
                      type: 'object',
                      properties: {
                        nextOffset: { type: 'integer', nullable: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Appointments'],
        summary: 'Create appointment',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Appointment' }
            }
          }
        },
        responses: {
          201: {
            description: 'Created appointment',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Appointment' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/branding': {
      get: {
        tags: ['Branding'],
        summary: 'Obter branding da conta',
        parameters: [
          {
            in: 'query',
            name: 'accountId',
            schema: { type: 'string' },
            description: 'ID da conta. Se omitido, tenta inferir pelo utilizador autenticado ou devolve o default.'
          }
        ],
        responses: {
          200: {
            description: 'Branding',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        account_name: { type: 'string' },
                        brand_primary: { type: 'string' },
                        brand_primary_soft: { type: 'string' },
                        brand_accent: { type: 'string' },
                        brand_accent_soft: { type: 'string' },
                        brand_background: { type: 'string' },
                        brand_gradient: { type: 'string', nullable: true },
                        logo_url: { type: 'string', nullable: true },
                        portal_image_url: { type: 'string', nullable: true },
                        support_email: { type: 'string', nullable: true },
                        support_phone: { type: 'string', nullable: true },
                        marketplace_region: { type: 'string', nullable: true },
                        marketplace_description: { type: 'string', nullable: true },
                        marketplace_instagram_url: { type: 'string', nullable: true },
                        marketplace_facebook_url: { type: 'string', nullable: true },
                        marketplace_tiktok_url: { type: 'string', nullable: true },
                        marketplace_website_url: { type: 'string', nullable: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      patch: {
        tags: ['Branding'],
        summary: 'Atualizar branding da conta (owner/admin)',
        security: [{ SupabaseBearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  brand_primary: { type: 'string' },
                  brand_primary_soft: { type: 'string' },
                  brand_accent: { type: 'string' },
                  brand_accent_soft: { type: 'string' },
                  brand_background: { type: 'string' },
                  brand_gradient: { type: 'string' },
                  logo_url: { type: 'string' },
                  portal_image_url: { type: 'string' },
                  support_email: { type: 'string' },
                  support_phone: { type: 'string' },
                  marketplace_region: { type: 'string' },
                  marketplace_description: { type: 'string' },
                  marketplace_instagram_url: { type: 'string' },
                  marketplace_facebook_url: { type: 'string' },
                  marketplace_tiktok_url: { type: 'string' },
                  marketplace_website_url: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Branding atualizado' },
          401: { description: 'Não autenticado' },
          403: { description: 'Sem permissões' }
        }
      }
    },
    '/branding/logo': {
      post: {
        tags: ['Branding'],
        summary: 'Upload do logo da conta (owner/admin)',
        security: [{ SupabaseBearer: [] }],
        parameters: [
          {
            in: 'query',
            name: 'accountId',
            schema: { type: 'string' },
            description: 'ID da conta. Se omitido, tenta inferir pelo utilizador autenticado.'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' }
                },
                required: ['file']
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Logo atualizado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' }
                  }
                }
              }
            }
          },
          401: { description: 'Não autenticado' },
          403: { description: 'Sem permissões' }
        }
      }
    },
    '/branding/portal-image': {
      post: {
        tags: ['Branding'],
        summary: 'Upload da imagem de capa do marketplace (owner/admin)',
        security: [{ SupabaseBearer: [] }],
        parameters: [
          {
            in: 'query',
            name: 'accountId',
            schema: { type: 'string' },
            description: 'ID da conta. Se omitido, tenta inferir pelo utilizador autenticado.'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' }
                },
                required: ['file']
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Imagem de capa atualizada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string' }
                  }
                }
              }
            }
          },
          401: { description: 'Não autenticado' },
          403: { description: 'Sem permissões' }
        }
      }
    },
    '/appointments/{id}/status': {
      patch: {
        tags: ['Appointments'],
        summary: 'Update appointment status',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { status: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Updated appointment',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Appointment' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/customers': {
      get: {
        tags: ['Customers'],
        summary: 'List customers',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: {
          200: {
            description: 'Array of customers',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Customer' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Customers'],
        summary: 'Create customer',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Customer' }
            }
          }
        },
        responses: {
          201: {
            description: 'Created customer'
          }
        }
      }
    },
    '/customers/{id}': {
      patch: {
        tags: ['Customers'],
        summary: 'Update customer',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Customer' }
            }
          }
        },
        responses: { 200: { description: 'Updated customer' } }
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete customer',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Deleted' } }
      }
    },
    '/customers/{id}/pets': {
      get: {
        tags: ['Customers'],
        summary: 'List pets for a customer',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Array of pets' } }
      }
    },
    '/services': {
      get: {
        tags: ['Services'],
        summary: 'List services',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: {
          200: {
            description: 'Array of services',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Service' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Services'],
        summary: 'Create service',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Service' }
            }
          }
        },
        responses: { 201: { description: 'Created service' } }
      }
    },
    '/services/{id}': {
      patch: {
        tags: ['Services'],
        summary: 'Update service',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Service' }
            }
          }
        },
        responses: { 200: { description: 'Updated service' } }
      },
      delete: {
        tags: ['Services'],
        summary: 'Delete service',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Deleted service' } }
      }
    }
  }
}

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [] // could be extended with JSDoc annotations for auto-generation
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
// Serve Swagger under the API prefix so proxies that forward `/api/*` also expose the docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec))
// Backwards compatibility: old /docs path now redirects to /api/docs
app.get('/docs', (_req, res) => res.redirect(301, '/api/docs'))
app.get('/docs.json', (_req, res) => res.redirect(301, '/api/docs.json'))

// Versioned routes (add /api/v2 later if needed)
app.get('/api/v1/health', (_req, res) => res.json({ ok: true }))
app.use('/api/v1', authRouter)
app.use('/api/v1/appointments', appointmentsRouter)
app.use('/api/v1/profile', profileRouter)
app.use('/api/v1/notifications', notificationsRouter)
app.use('/api/v1/domains', domainsRouter)
app.use('/api/v1/customers', customersRouter)
app.use('/api/v1/pet-attributes', petAttributesRouter)
app.use('/api/v1/services', servicesRouter)
app.use('/api/v1/branding', brandingRouter)
app.use('/api/v1/account', accountMembersRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/public', publicRouter)
app.use('/api/v1/marketplace', marketplaceRouter)

export default app
