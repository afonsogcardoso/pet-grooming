import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
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
import analyticsRouter from './routes/analytics.js'
import sessionRouter from './routes/session.js'
import { getSupabaseServiceRoleClient } from './authClient.js'

const envResult = dotenv.config({ path: '.env.local' })
if (envResult.error) {
  dotenv.config()
}

const app = express()

// Serve static public assets (e.g. bundled fallback icon)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use(express.static(path.join(__dirname, '..', 'public')))

// Debug endpoint to inspect static path and file existence
app.get('/_debug/assets', (_req, res) => {
  const staticPath = path.join(__dirname, '..', 'public')
  const assetPath = path.join(staticPath, 'assets', 'icon.png')
  const exists = fs.existsSync(assetPath)
  let stat = null
  try {
    stat = exists ? fs.statSync(assetPath) : null
  } catch (e) {
    // ignore
  }
  res.json({ staticPath, assetPath, exists, size: stat ? stat.size : null })
})

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
  // If API already provided an account id (api key middleware or previous middleware), prefer that
  if (req.accountId) {
    if (process.env.NODE_ENV !== 'production') console.debug('[account-resolver] request already has accountId', req.accountId)
    return next()
  }

  // Allow quick path when no supabase admin client is available
  if (!supabaseAdmin) {
    if (process.env.NODE_ENV !== 'production') console.debug('[account-resolver] no supabase admin client available')
    return next()
  }

  // Respect explicit X-Account-Id header if provided by clients
  const headerAccount = req.headers['x-account-id'] || req.headers['X-Account-Id'] || req.headers['x-accountid']
  if (headerAccount) {
    // do not log full header in production
    if (process.env.NODE_ENV !== 'production') console.debug('[account-resolver] using X-Account-Id header', headerAccount)
    req.accountId = String(headerAccount)
    return next()
  }

  // Fallback to resolving from Bearer token membership
  const auth = req.headers.authorization || ''
  const token = typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice('Bearer '.length) : null
  if (!token) {
    if (process.env.NODE_ENV !== 'production') console.debug('[account-resolver] no bearer token present')
    return next()
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (process.env.NODE_ENV !== 'production') {
      try {
        const masked = typeof token === 'string' && token.length > 12 ? `${token.slice(0, 6)}...${token.slice(-6)}` : token
        console.debug('[account-resolver] supabase.getUser call; token(masked)=', masked)
        console.debug('[account-resolver] supabase.getUser result=', {
          userId: userData?.user?.id || null,
          user_metadata: userData?.user?.user_metadata || null
        })
      } catch (e) {
        // ignore
      }
    }
    if (userError || !userData?.user?.id) {
      if (process.env.NODE_ENV !== 'production') console.debug('[account-resolver] bearer token did not resolve to user', userError)
      return next()
    }
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
      if (process.env.NODE_ENV !== 'production') console.debug('[account-resolver] resolved account from membership', { userId, accountId: membership.account_id })
    } else {
      if (process.env.NODE_ENV !== 'production') console.debug('[account-resolver] no accepted membership found for user', userId)
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
    { name: 'Marketplace', description: 'Marketplace discovery and requests' },
    { name: 'AccountMembers', description: 'Account membership management' },
    { name: 'Admin', description: 'Platform admin endpoints' },
    { name: 'Notifications', description: 'Notification preferences and devices' },
    { name: 'Domains', description: 'Custom domain management' },
    { name: 'PetAttributes', description: 'Pet species and breed lookup' },
    { name: 'Public', description: 'Public account lookup' }
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
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string', nullable: true }
        }
      },
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
      Account: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          plan: { type: 'string' },
          is_active: { type: 'boolean' }
        }
      },
      AccountMember: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          account_id: { type: 'string' },
          user_id: { type: 'string' },
          role: { type: 'string', enum: ['owner', 'admin', 'member'] },
          status: { type: 'string', enum: ['pending', 'accepted', 'revoked'] },
          email: { type: 'string', format: 'email', nullable: true }
        }
      },
      Branding: {
        type: 'object',
        properties: {
          account_id: { type: 'string' },
          account_name: { type: 'string' },
          brand_primary: { type: 'string' },
          brand_primary_soft: { type: 'string' },
          brand_accent: { type: 'string' },
          brand_accent_soft: { type: 'string' },
          brand_background: { type: 'string' },
          brand_gradient: { type: 'string' },
          logo_url: { type: 'string', nullable: true },
          portal_image_url: { type: 'string', nullable: true },
          support_email: { type: 'string', nullable: true },
          support_phone: { type: 'string', nullable: true }
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
      AppointmentPhoto: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          appointment_id: { type: 'string' },
          url: { type: 'string' },
          thumb_url: { type: 'string', nullable: true },
          type: { type: 'string' }
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
      },
      ServiceAddon: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          service_id: { type: 'string' }
        }
      },
      ServicePriceTier: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          price: { type: 'number' },
          service_id: { type: 'string' }
        }
      },
      CustomerPet: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          breed: { type: 'string', nullable: true },
          photo_url: { type: 'string', nullable: true }
        }
      },
      NotificationPreferences: {
        type: 'object',
        additionalProperties: { type: 'boolean' }
      },
      DomainRequest: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: { type: 'string' },
          dnsRecordType: { type: 'string', enum: ['cname', 'a'] }
        }
      },
      MarketplaceAccount: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          logo_url: { type: 'string', nullable: true },
          marketplace_region: { type: 'string', nullable: true }
        }
      },
      MarketplaceService: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string', nullable: true },
          price: { type: 'number', nullable: true },
          image_url: { type: 'string', nullable: true }
        }
      },
      MarketplacePet: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          breed: { type: 'string', nullable: true },
          photo_url: { type: 'string', nullable: true }
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
    '/auth/signup': {
      post: {
        tags: ['Auth'],
        summary: 'Criar utilizador e conta (provider ou consumer)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  accountName: { type: 'string', nullable: true },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  phone: { type: 'string', nullable: true },
                  phoneCountryCode: { type: 'string', nullable: true },
                  phoneNumber: { type: 'string', nullable: true },
                  role: { type: 'string', enum: ['provider', 'consumer'] }
                },
                required: ['email', 'password', 'firstName', 'lastName']
              }
            }
          }
        },
        responses: {
          200: { description: 'Conta criada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthLoginResponse' } } } },
          400: { description: 'Payload inválido', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/auth/oauth-signup': {
      post: {
        tags: ['Auth'],
        summary: 'Criar utilizador via OAuth payload',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        responses: {
          200: { description: 'Conta criada' },
          400: { description: 'Payload inválido' }
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
      ,
      patch: {
        tags: ['Profile'],
        summary: 'Atualizar perfil',
        security: [{ SupabaseBearer: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } }
        },
        responses: {
          200: { description: 'Perfil atualizado' },
          400: { description: 'Payload inválido' },
          401: { description: 'Não autenticado' }
        }
      }
    },
    '/profile/avatar': {
      post: {
        tags: ['Profile'],
        summary: 'Upload de avatar',
        security: [{ SupabaseBearer: [] }],
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
          200: { description: 'Avatar carregado' },
          401: { description: 'Não autenticado' }
        }
      }
    },
    '/profile/reset-password': {
      post: {
        tags: ['Profile'],
        summary: 'Enviar email de reset de password',
        security: [{ SupabaseBearer: [] }],
        responses: {
          200: { description: 'Email enviado' },
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
      },
      delete: {
        tags: ['Branding'],
        summary: 'Remover logo da conta',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'Logo removido' } }
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
      },
      delete: {
        tags: ['Branding'],
        summary: 'Remover imagem de portal',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'Imagem removida' } }
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
    '/appointments/{id}': {
      get: {
        tags: ['Appointments'],
        summary: 'Get appointment detail',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Appointment', content: { 'application/json': { schema: { $ref: '#/components/schemas/Appointment' } } } }, 404: { description: 'Not found' } }
      },
      patch: {
        tags: ['Appointments'],
        summary: 'Update appointment',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Appointment' } } } },
        responses: { 200: { description: 'Updated' } }
      },
      delete: {
        tags: ['Appointments'],
        summary: 'Delete appointment',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } }
      }
    },
    '/appointments/{id}/photos': {
      post: {
        tags: ['Appointments'],
        summary: 'Upload appointment photo',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] }
            }
          }
        },
        responses: { 200: { description: 'Uploaded', content: { 'application/json': { schema: { $ref: '#/components/schemas/AppointmentPhoto' } } } } }
      },
      get: {
        tags: ['Appointments'],
        summary: 'List appointment photos',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Photos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AppointmentPhoto' } } } } } }
      }
    },
    '/appointments/photos/{photoId}': {
      delete: {
        tags: ['Appointments'],
        summary: 'Delete appointment photo',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'photoId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' } }
      }
    },
    '/appointments/confirm': {
      get: {
        tags: ['Appointments'],
        summary: 'Public confirmation payload',
        parameters: [
          { in: 'query', name: 'token', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'id', required: false, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Confirmation data' }, 400: { description: 'Invalid token' } }
      }
    },
    '/appointments/confirm-open': {
      post: {
        tags: ['Appointments'],
        summary: 'Mark confirmation as opened',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] } } } },
        responses: { 200: { description: 'Marked' } }
      }
    },
    '/appointments/{id}/share': {
      get: {
        tags: ['Appointments'],
        summary: 'Generate share link',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Share link' } }
      }
    },
    '/appointments/ics': {
      get: {
        tags: ['Appointments'],
        summary: 'ICS calendar download',
        parameters: [{ in: 'query', name: 'token', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'ICS file' } }
      }
    },
    '/appointments/pet-photo': {
      post: {
        tags: ['Appointments'],
        summary: 'Upload pet photo (public)',
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } } }
        },
        responses: { 200: { description: 'Uploaded' } }
      }
    },
    '/appointments/reminders': {
      post: {
        tags: ['Appointments'],
        summary: 'Create reminder jobs for eligible appointments',
        security: [{ ApiKeyAuth: [] }],
        responses: { 200: { description: 'Scheduled' } }
      }
    },
    '/appointments/overdue-count': {
      get: {
        tags: ['Appointments'],
        summary: 'Count overdue confirmations',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Counts' } }
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
    },
    '/services/{id}/image': {
      post: {
        tags: ['Services'],
        summary: 'Upload service image',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
                required: ['file']
              }
            }
          }
        },
        responses: { 200: { description: 'Uploaded image' } }
      }
    },
    '/services/{id}/price-tiers': {
      get: {
        tags: ['Services'],
        summary: 'List price tiers',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Price tiers', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ServicePriceTier' } } } } } }
      },
      post: {
        tags: ['Services'],
        summary: 'Create price tier',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServicePriceTier' } } } },
        responses: { 201: { description: 'Created price tier' } }
      }
    },
    '/services/{id}/price-tiers/{tierId}': {
      patch: {
        tags: ['Services'],
        summary: 'Update price tier',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'tierId', required: true, schema: { type: 'string' } }
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServicePriceTier' } } } },
        responses: { 200: { description: 'Updated price tier' } }
      },
      delete: {
        tags: ['Services'],
        summary: 'Delete price tier',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'tierId', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Deleted price tier' } }
      }
    },
    '/services/{id}/addons': {
      get: {
        tags: ['Services'],
        summary: 'List service addons',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Addons', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/ServiceAddon' } } } } } }
      },
      post: {
        tags: ['Services'],
        summary: 'Create addon',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceAddon' } } } },
        responses: { 201: { description: 'Created addon' } }
      }
    },
    '/services/{id}/addons/{addonId}': {
      patch: {
        tags: ['Services'],
        summary: 'Update addon',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'addonId', required: true, schema: { type: 'string' } }
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ServiceAddon' } } } },
        responses: { 200: { description: 'Updated addon' } }
      },
      delete: {
        tags: ['Services'],
        summary: 'Delete addon',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'addonId', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Deleted addon' } }
      }
    },
    '/customers/{id}/pets': {
      post: {
        tags: ['Customers'],
        summary: 'Create pet for customer',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerPet' } } } },
        responses: { 201: { description: 'Created pet' } }
      }
    },
    '/customers/{customerId}/pets/{petId}': {
      patch: {
        tags: ['Customers'],
        summary: 'Update pet',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'customerId', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'petId', required: true, schema: { type: 'string' } }
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CustomerPet' } } } },
        responses: { 200: { description: 'Updated pet' } }
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete pet',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [
          { in: 'path', name: 'customerId', required: true, schema: { type: 'string' } },
          { in: 'path', name: 'petId', required: true, schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Deleted pet' } }
      }
    },
    '/customers/{id}/photo': {
      post: {
        tags: ['Customers'],
        summary: 'Upload customer photo',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } } }
        },
        responses: { 200: { description: 'Uploaded photo' } }
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete customer photo',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted photo' } }
      }
    },
    '/customers/{petId}/pet-photo': {
      post: {
        tags: ['Customers'],
        summary: 'Upload pet photo',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'petId', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } } }
        },
        responses: { 200: { description: 'Uploaded photo' } }
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete pet photo',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'petId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted photo' } }
      }
    },
    '/account/members': {
      get: {
        tags: ['AccountMembers'],
        summary: 'Listar membros da conta',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Membros', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AccountMember' } } } } } }
      },
      post: {
        tags: ['AccountMembers'],
        summary: 'Convidar membro',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountMember' } } } },
        responses: { 201: { description: 'Convite criado' } }
      }
    },
    '/account/members/accept': {
      post: {
        tags: ['AccountMembers'],
        summary: 'Aceitar convite',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] } } } },
        responses: { 200: { description: 'Aceite' } }
      }
    },
    '/account/members/invite': {
      post: {
        tags: ['AccountMembers'],
        summary: 'Gerar convite',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Convite enviado' } }
      }
    },
    '/account/members/invite/resend': {
      post: {
        tags: ['AccountMembers'],
        summary: 'Reenviar convite',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Convite reenviado' } }
      }
    },
    '/account/members/invite/cancel': {
      post: {
        tags: ['AccountMembers'],
        summary: 'Cancelar convite',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Convite cancelado' } }
      }
    },
    '/account/members/{memberId}/role': {
      patch: {
        tags: ['AccountMembers'],
        summary: 'Atualizar role',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'memberId', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string' } }, required: ['role'] } } } },
        responses: { 200: { description: 'Role atualizado' } }
      }
    },
    '/account/members/{memberId}': {
      delete: {
        tags: ['AccountMembers'],
        summary: 'Remover membro',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'memberId', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Removido' } }
      }
    },
    '/notifications/preferences': {
      get: {
        tags: ['Notifications'],
        summary: 'Obter preferências',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'Preferências', content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationPreferences' } } } } }
      },
      put: {
        tags: ['Notifications'],
        summary: 'Atualizar preferências',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationPreferences' } } } },
        responses: { 200: { description: 'Atualizado' } }
      }
    },
    '/notifications/push/register': {
      post: {
        tags: ['Notifications'],
        summary: 'Registar token push',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { pushToken: { type: 'string' }, platform: { type: 'string' } }, required: ['pushToken'] } } } },
        responses: { 200: { description: 'Registado' } }
      }
    },
    '/notifications/push/unregister': {
      post: {
        tags: ['Notifications'],
        summary: 'Desregistar token push',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { pushToken: { type: 'string' } }, required: ['pushToken'] } } } },
        responses: { 200: { description: 'Removido' } }
      }
    },
    '/domains': {
      get: {
        tags: ['Domains'],
        summary: 'Listar domínios',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Domínios' } }
      },
      post: {
        tags: ['Domains'],
        summary: 'Adicionar domínio',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DomainRequest' } } } },
        responses: { 201: { description: 'Criado' } }
      },
      delete: {
        tags: ['Domains'],
        summary: 'Remover domínio',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DomainRequest' } } } },
        responses: { 200: { description: 'Removido' } }
      }
    },
    '/domains/verify': {
      post: {
        tags: ['Domains'],
        summary: 'Verificar registo DNS',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DomainRequest' } } } },
        responses: { 200: { description: 'Resultado' } }
      }
    },
    '/pet-attributes/species': {
      get: {
        tags: ['PetAttributes'],
        summary: 'Listar espécies',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Espécies' } }
      }
    },
    '/pet-attributes/breeds': {
      get: {
        tags: ['PetAttributes'],
        summary: 'Listar raças',
        security: [{ ApiKeyAuth: [] }, { SupabaseBearer: [] }],
        responses: { 200: { description: 'Raças' } }
      }
    },
    '/marketplace/accounts': {
      get: {
        tags: ['Marketplace'],
        summary: 'Listar contas no marketplace',
        responses: { 200: { description: 'Contas', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MarketplaceAccount' } } } } } }
      }
    },
    '/marketplace/accounts/{slug}': {
      get: {
        tags: ['Marketplace'],
        summary: 'Obter conta do marketplace',
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Conta', content: { 'application/json': { schema: { $ref: '#/components/schemas/MarketplaceAccount' } } } }, 404: { description: 'Não encontrada' } }
      }
    },
    '/marketplace/accounts/{slug}/services': {
      get: {
        tags: ['Marketplace'],
        summary: 'Listar serviços de uma conta',
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Serviços', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MarketplaceService' } } } } } }
      }
    },
    '/marketplace/pets': {
      get: {
        tags: ['Marketplace'],
        summary: 'Listar pets do consumidor',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'Pets', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/MarketplacePet' } } } } } }
      },
      post: {
        tags: ['Marketplace'],
        summary: 'Criar pet do consumidor',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MarketplacePet' } } } },
        responses: { 201: { description: 'Criado' } }
      }
    },
    '/marketplace/pets/{id}': {
      patch: {
        tags: ['Marketplace'],
        summary: 'Atualizar pet do consumidor',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MarketplacePet' } } } },
        responses: { 200: { description: 'Atualizado' } }
      },
      delete: {
        tags: ['Marketplace'],
        summary: 'Apagar pet do consumidor',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Apagado' } }
      }
    },
    '/marketplace/pets/{id}/photo': {
      post: {
        tags: ['Marketplace'],
        summary: 'Upload foto do pet',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } } } },
        responses: { 200: { description: 'Upload ok' } }
      },
      delete: {
        tags: ['Marketplace'],
        summary: 'Apagar foto do pet',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Apagado' } }
      }
    },
    '/marketplace/my-appointments': {
      get: {
        tags: ['Marketplace'],
        summary: 'Listar marcações do consumidor',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'Marcações' } }
      }
    },
    '/marketplace/my-appointments/{id}': {
      get: {
        tags: ['Marketplace'],
        summary: 'Detalhe de marcação',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Detalhe' }, 404: { description: 'Não encontrada' } }
      }
    },
    '/marketplace/my-appointments/{id}/cancel': {
      patch: {
        tags: ['Marketplace'],
        summary: 'Cancelar marcação',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Cancelada' } }
      }
    },
    '/marketplace/booking-requests': {
      post: {
        tags: ['Marketplace'],
        summary: 'Criar pedido de marcação',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Criado' } }
      }
    },
    '/public/accounts/{slug}': {
      get: {
        tags: ['Public'],
        summary: 'Consultar conta pública',
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Conta', content: { 'application/json': { schema: { $ref: '#/components/schemas/MarketplaceAccount' } } } }, 404: { description: 'Não encontrada' } }
      }
    },
    '/admin/accounts': {
      get: {
        tags: ['Admin'],
        summary: 'Listar contas (admin)',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'Contas', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Account' } } } } }, 403: { description: 'Forbidden' } }
      },
      post: {
        tags: ['Admin'],
        summary: 'Criar conta',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } },
        responses: { 201: { description: 'Criada' } }
      },
      patch: {
        tags: ['Admin'],
        summary: 'Atualizar conta',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } },
        responses: { 200: { description: 'Atualizada' } }
      },
      put: {
        tags: ['Admin'],
        summary: 'Upsert conta',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } },
        responses: { 200: { description: 'Atualizada' } }
      }
    },
    '/admin/accounts/{id}': {
      get: {
        tags: ['Admin'],
        summary: 'Detalhe da conta',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Conta', content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } } }, 404: { description: 'Não encontrada' } }
      }
    },
    '/admin/accounts/{id}/members': {
      get: {
        tags: ['Admin'],
        summary: 'Listar membros da conta',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Membros', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AccountMember' } } } } } }
      },
      post: {
        tags: ['Admin'],
        summary: 'Adicionar membro',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountMember' } } } },
        responses: { 201: { description: 'Criado' } }
      },
      patch: {
        tags: ['Admin'],
        summary: 'Atualizar membro',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountMember' } } } },
        responses: { 200: { description: 'Atualizado' } }
      },
      delete: {
        tags: ['Admin'],
        summary: 'Remover membro',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Removido' } }
      }
    },
    '/admin/apikeys': {
      get: {
        tags: ['Admin'],
        summary: 'Listar API Keys',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'API Keys' } }
      },
      post: {
        tags: ['Admin'],
        summary: 'Criar API Key',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 201: { description: 'Criada' } }
      },
      patch: {
        tags: ['Admin'],
        summary: 'Atualizar API Key',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Atualizada' } }
      },
      delete: {
        tags: ['Admin'],
        summary: 'Remover API Key',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Removida' } }
      }
    },
    '/admin/users': {
      get: {
        tags: ['Admin'],
        summary: 'Listar utilizadores',
        security: [{ SupabaseBearer: [] }],
        responses: { 200: { description: 'Utilizadores' } }
      }
    },
    '/admin/users/reset-password': {
      post: {
        tags: ['Admin'],
        summary: 'Forçar reset de password',
        security: [{ SupabaseBearer: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email: { type: 'string', format: 'email' } }, required: ['email'] } } } },
        responses: { 200: { description: 'Email enviado' } }
      }
    },
    '/admin/accounts/{id}/maintenance': {
      post: {
        tags: ['Admin'],
        summary: 'Atualizar flag de manutenção',
        security: [{ SupabaseBearer: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } } } },
        responses: { 200: { description: 'Atualizado' } }
      }
    }
  }
}

const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [] // could be extended with JSDoc annotations for auto-generation
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

// Serve Swagger docs using CDN assets to avoid bundling issues on Vercel
app.get('/api/docs', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Pawmi API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        SwaggerUIBundle({
          url: '/api/docs.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'BaseLayout'
        });
      };
    </script>
  </body>
</html>`)
})

// Homepage for the API root. Attempts to resolve tenant branding by Host
async function fetchBrandingForHost(host) {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase || !host) return null

  // strip port if present
  const hostname = host.split(':')[0]

  // try to resolve custom domain -> account
  try {
    const { data: domainRow, error: domainErr } = await supabase
      .from('custom_domains')
      .select('account_id')
      .eq('domain', hostname)
      .eq('status', 'active')
      .maybeSingle()

    if (domainErr) return null
    const accountId = domainRow?.account_id || null
    if (!accountId) return null

    const { data: accountRow, error: accErr } = await supabase
      .from('accounts')
      .select('id, name, brand_primary, brand_primary_soft, brand_accent, brand_accent_soft, brand_background, brand_gradient, logo_url, portal_image_url, support_email, support_phone')
      .eq('id', accountId)
      .maybeSingle()

    if (accErr || !accountRow) return null
    return {
      account_name: accountRow.name || 'Pawmi',
      brand_primary: accountRow.brand_primary || '#4fafa9',
      brand_primary_soft: accountRow.brand_primary_soft || '#ebf5f4',
      brand_accent: accountRow.brand_accent || '#f4d58d',
      brand_accent_soft: accountRow.brand_accent_soft || '#fdf6de',
      brand_background: accountRow.brand_background || '#f6f9f8',
      brand_gradient: accountRow.brand_gradient || 'linear-gradient(135deg, #4fafa9, #f4d58d)',
      logo_url: accountRow.logo_url || null,
      portal_image_url: accountRow.portal_image_url || null,
      support_email: accountRow.support_email || null,
      support_phone: accountRow.support_phone || null
    }
  } catch (e) {
    return null
  }
}

const DEFAULT_BRANDING = {
  account_name: 'Pawmi',
  brand_primary: '#4fafa9',
  brand_primary_soft: '#ebf5f4',
  brand_accent: '#f4d58d',
  brand_accent_soft: '#fdf6de',
  brand_background: '#f6f9f8',
  brand_gradient: 'linear-gradient(135deg, #4fafa9, #f4d58d)',
  logo_url: null,
  portal_image_url: null,
  support_email: null,
  support_phone: null
}

app.get('/', async (req, res) => {
  const host = req.headers.host || ''
  const branding = (await fetchBrandingForHost(host)) || DEFAULT_BRANDING

  const primary = branding.brand_primary || DEFAULT_BRANDING.brand_primary
  const accent = branding.brand_accent || DEFAULT_BRANDING.brand_accent
  const bg = branding.brand_background || DEFAULT_BRANDING.brand_background
  // use bundled API icon as fallback when branding has no logo
  const publicFallback = 'assets/icon.png'
  const logo = branding.logo_url || publicFallback
  const title = 'Pawmi API'

  res.type('html').send(`<!doctype html>
<html lang="pt">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:${bg}}
      .card{background:#fff;padding:28px;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,0.08);max-width:620px;text-align:center}
      .brand{display:flex;align-items:center;justify-content:center;margin-bottom:12px}
      .logo{height:64px;border-radius:8px;object-fit:contain}
      .logo-placeholder{width:64px;height:64px;border-radius:8px;background:${primary};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:24px}
      h1{margin:0 0 8px;font-size:20px}
      p{color:#334155;margin:0 0 18px}
      .btn{display:inline-block;padding:10px 16px;background:${primary};color:#fff;border-radius:8px;text-decoration:none;margin:6px}
      .btn-accent{background:${accent};color:#111}
      .link{color:${primary};text-decoration:none;margin:6px}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">
        ${logo ? `<img src="${logo}" alt="logo" class="logo"/>` : `<div class="logo-placeholder">${(title || 'P')[0]}</div>`}
      </div>
      <h1>${title}</h1>
      <p>Bem-vindo à API. A documentação interativa está disponível abaixo.</p>
      <div>
        <a class="btn" href="/api/docs">Abrir documentação (Swagger)</a>
        <a class="btn btn-accent" href="/api/docs.json">Ver spec JSON</a>
      </div>
      <div style="margin-top:12px">
        <a class="link" href="/api/v1/health">Health check</a>
        <a class="link" href="/docs">Legacy /docs</a>
      </div>
    </div>
  </body>
</html>`)
})

app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec))
// Backwards compatibility: old /docs path now redirects to /api/docs
app.get('/docs', (_req, res) => res.redirect(301, '/api/docs'))
app.get('/docs.json', (_req, res) => res.redirect(301, '/api/docs.json'))

// Versioned routes (add /api/v2 later if needed)
app.get('/api/v1/health', (_req, res) => res.json({ ok: true }))
app.use('/api/v1', authRouter)
app.use('/api/v1/appointments', appointmentsRouter)
app.use('/api/v1/profile', profileRouter)
app.use('/api/v1/analytics', analyticsRouter)
app.use('/api/v1/notifications', notificationsRouter)
app.use('/api/v1/domains', domainsRouter)
app.use('/api/v1/customers', customersRouter)
app.use('/api/v1/pet-attributes', petAttributesRouter)
app.use('/api/v1/services', servicesRouter)
app.use('/api/v1/branding', brandingRouter)
app.use('/api/v1/session', sessionRouter)
app.use('/api/v1/account', accountMembersRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/public', publicRouter)
app.use('/api/v1/marketplace', marketplaceRouter)

export default app
