Lista de componentes a extrair da `NewAppointmentScreen`

Objetivo: dividir o ficheiro monolítico em componentes pequenos e um hook para a lógica.

Componentes sugeridos (arquivos sugeridos em `src/components/appointments/`):

- `Stepper.tsx`
  - Responsabilidade: renderizar os botões do passo (ícones/etapas), gerir navegação entre passos.
  - Props: `steps`, `activeStep`, `goToStep`, `stepAccess`.

- `ScheduleSection.tsx` (já existe)
  - Responsabilidade: data/hora e recorrência.

- `CustomerSection.tsx`
  - Responsabilidade: toda a UI relacionada com cliente (novo/existente), formulários e seleção de pets.
  - Props: hooks/state handlers para falar com o `useAppointmentForm`.

- `PetServices.tsx`
  - Responsabilidade: lista de pets, linhas de serviço por pet, adição/remoção de serviços.
  - Pode compor `PetCard`, `PetServiceRow` (separados) para melhor granularidade.

- `SummarySection.tsx`
  - Responsabilidade: totais, revisão de serviços e preço, edição de montante.

- `NotesSection.tsx` ou `AdditionalInfo.tsx`
  - Responsabilidade: reminders, WhatsApp toggle, notas adicionais.

- `AppointmentForm.tsx` (opcional)
  - Responsabilidade: componente composto que monta `Stepper` + seções; `NewAppointmentScreen` passa apenas orquestração (navigation, submit).

Hook sugerido:
- `useAppointmentForm` (em `src/hooks/useAppointmentForm.ts`)
  - Responsabilidade: centralizar estado, validação, handlers (add/remove pet, add/remove service, submit), efeitos colaterais (fetches) e exposição de valores para os componentes.

Próximo passo recomendado:
- Extrair `Stepper` e ligar ao novo `useAppointmentForm` (mais fácil e com baixo risco), depois `CustomerSection`.
