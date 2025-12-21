# Pawmi Mobile (Expo + React Native)

Base do app mobile em TypeScript, consumindo sua API.

## Pré-requisitos
- Node 18+ e npm.
- Xcode + simulador iOS instalados.
- Conta Expo (opcional) para EAS/TestFlight.

## Setup rápido
```bash
# na raiz do projeto pawmi-mobile
cp .env.example .env             # configure API_BASE_URL
npm install                      # já executado na criação, rode se necessário
npx expo start --ios             # abre no simulador
```

## Ambiente
- `.env` (não commitar):
  ```
  API_BASE_URL=https://api.sua-plataforma.com
  ```
- `app.config.js` expõe `extra.apiBaseUrl` para o app.
- Tokens ficam no `SecureStore` (`authToken` / `refreshToken`).

## Estrutura
- `src/api/client.ts`: axios com baseURL da API e Authorization via SecureStore.
- `src/api/auth.ts`: login/refresh.
- `src/state/authStore.ts`: estado de auth (Zustand + SecureStore).
- `src/screens/LoginScreen.tsx`: formulário com RHF + Zod + React Query mutation.
- `src/screens/HomeScreen.tsx`: placeholder pós-login + logout.
- `App.tsx`: QueryClientProvider + NavigationContainer + stack Login/Home.
- `tailwind.config.js` + `nativewind` prontos para styling utilitário.

## Próximos passos sugeridos
- Implementar refresh automático no interceptor (401 -> refresh).
- Adicionar queries/mutations por feature (services/bookings/clients) em `src/api`.
- Criar componentes base (Button/Input/Card/ListItem) e tema único.
- Colocar validação/Zod schemas para payloads de criação/edição.
- Configurar Sentry/analytics e lint/prettier.
