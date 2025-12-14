# Guia rápido: app mobile iOS (Expo + React Native)

Objetivo: criar um projeto mobile separado, ao lado do atual, apontando para a mesma API.

## Por que essa stack é atual/futura
- Expo + React Native + TypeScript: mantidos ativamente, roadmap sólido, suporte a EAS/OTA, comunidade grande.
- React Navigation/Expo Router: padrão de mercado, suporte oficial RN.
- React Query + Zustand + RHF + Zod: bibliotecas modernas, em crescimento e compatíveis com RN; facilitam cache, formulários e validação tipada.
- NativeWind/Tamagui: abordagens modernas de styling com suporte RN; opcionais.

## 1) Pré-requisitos
- Node LTS (>=18), npm ou pnpm.
- Xcode + simulador iOS instalado; `brew install watchman` ajuda no hot reload.
- Conta Expo (opcional, mas útil para EAS/TestFlight).

## 2) Criar o projeto numa pasta irmã (TypeScript recomendado)
```bash
cd ..
npx create-expo-app@latest verza-mobile --template blank-typescript
cd verza-mobile
git init
```

## 3) Stack recomendada (melhores práticas)
- Expo + React Native + TypeScript (template blank-typescript).
- React Navigation (stack + tabs) + Expo Router se quiser arquivos/rotas.
- React Query para dados server-state; Zustand para estado global simples.
- React Hook Form + Zod para formulários tipados/validação.
- NativeWind (Tailwind-in-RN) ou Tamagui/Restyle para consistência visual.
- SecureStore para tokens; AsyncStorage para cache leve.

## 4) Dependências base
```bash
# Navegação, formulários, HTTP, storage seguro
npx expo install @react-navigation/native @react-navigation/native-stack \
  react-native-screens react-native-safe-area-context \
  axios @react-native-async-storage/async-storage \
  expo-secure-store

# Dados/estado/validação
npm install @tanstack/react-query zustand react-hook-form zod @hookform/resolvers

# Estilo (opcional): Tailwind-in-RN
npx expo install nativewind tailwindcss
```

## 5) Estrutura sugerida
```
verza-mobile/
  app/                # rotas (Expo Router) ou ponto de entrada NavigationContainer
  src/
    api/              # cliente HTTP, hooks
    components/       # UI reutilizável
    screens/          # telas (Login, Home, Agenda, Perfil, Serviços, etc.)
    state/            # Zustand/Redux ou contextos
    theme/            # tokens de cor, tipografia, spacing
    utils/
  .env                # API_BASE_URL, etc. (não commitar)
```

## 6) Config de ambiente
- Crie `.env` na raiz do mobile:
  ```
  API_BASE_URL=https://sua-api.com
  ```
- Expor no app config (`app.config.js`):
  ```js
  import 'dotenv/config';
  export default {
    name: 'Verza',
    slug: 'verza-mobile',
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
    },
  };
  ```
- Ler em runtime: `import Constants from 'expo-constants'; const { apiBaseUrl } = Constants.expoConfig.extra;`

## 7) Cliente HTTP
`src/api/client.ts`
```ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const api = axios.create({
  baseURL: Constants.expoConfig?.extra?.apiBaseUrl,
});

api.interceptors.request.use(async config => {
  const token = await SecureStore.getItemAsync('authToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

## 8) Navegação mínima
`App.tsx` (ou `app/_layout.tsx` se usar Expo Router)
```tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

## 9) Rodar no simulador iOS
```bash
npx expo start --ios
```

## 10) Próximos passos
- Implementar login/refresh + armazenamento de token no `SecureStore`.
- Criar telas principais: Agenda/Bookings, Serviços, Clientes, Perfil.
- Adicionar tema consistente (tokens de cor/tipo) e componentes base (Button, Input, ListItem).
- Criar camada de dados com React Query (queries/mutations) e cache.
- Formulários com React Hook Form + Zod (ex: login, criação/edição de serviço).
- Lint/format (eslint/prettier) e testes com RTL/Jest quando estabilizar.
- Configurar Sentry/analytics (opcional).
- Configurar EAS Build + TestFlight quando tiver fluxo básico estável.

## Integração via sua API (passo a passo)
1) **Definir endpoints e contratos**: listar endpoints da sua API (login, refresh, profile, services, bookings, clients). Criar tipos TS para requisições/respostas.
2) **Configurar ambiente**: `API_BASE_URL` no `.env` (não commitar). Garantir que a API aceita CORS/mobile e TLS.
3) **Auth**:
   - Criar `login` mutation (React Query) que chama `/auth/login` e grava `authToken` no `SecureStore`.
   - Criar `refresh` flow: interceptor ou hook que troca tokens em 401/refresh expirando.
   - Logout: apagar tokens do `SecureStore`.
4) **Camada de dados**:
   - `src/api/queries.ts` e `src/api/mutations.ts` para React Query com chaves estáveis (`['services']`, `['bookings', params]`).
   - Usar `api` (axios) com `Authorization: Bearer <token>` injetado pelo interceptor.
5) **Screens**:
   - Login → Home (após sucesso).
   - Home → tabs para Agenda, Serviços, Clientes/Perfil.
   - Cada tela consome queries/mutations respectivas.
6) **Offline/cache** (básico): React Query já faz cache; habilitar `staleTime` adequado e revalidação no foco.
7) **Uploads**: se precisar de upload (fotos), implementar endpoint na API que gere URL assinada; no app, usar `fetch/axios` multipart ou upload direto para storage usando a URL.
8) **Erros e UX**: normalizar erros da API, exibir toasts/modals; mapear códigos comuns (401, 403, 409).
9) **Segurança**: nunca expor chaves Supabase; tudo passa pela API; usar `SecureStore` para tokens e evitar logs com dados sensíveis.
