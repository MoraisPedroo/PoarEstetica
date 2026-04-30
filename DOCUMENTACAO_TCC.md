# Documentação Técnica — TCC
## Sistema de Gestão para Clínica de Estética — Poar Estética

> **Aluno:** Pedro Morais  
> **Disciplina:** Trabalho de Conclusão de Curso  
> **Tecnologias:** HTML5 · CSS3 · JavaScript Vanilla · Firebase (Auth + Firestore + Storage) · WAHA (WhatsApp API) · Vercel

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Requisitos do Sistema](#2-requisitos-do-sistema)
3. [Arquitetura do Sistema](#3-arquitetura-do-sistema)
4. [Diagrama de Casos de Uso](#4-diagrama-de-casos-de-uso)
5. [Diagrama de Classes](#5-diagrama-de-classes)
6. [Modelo de Banco de Dados](#6-modelo-de-banco-de-dados)
7. [Diagramas de Fluxo](#7-diagramas-de-fluxo)
8. [Diagramas de Sequência](#8-diagramas-de-sequência)
9. [Diagrama de Componentes](#9-diagrama-de-componentes)
10. [Descrição das Telas](#10-descrição-das-telas)
11. [Heurísticas IHC Aplicadas](#11-heurísticas-ihc-aplicadas)

---

## 1. Visão Geral do Sistema

O **Poar Estética** é um sistema web de gestão para uma clínica de estética, desenvolvido como aplicação PWA (Progressive Web App) com abordagem **mobile-first**. O sistema permite que clientes façam agendamentos de serviços e compras de produtos online, enquanto a administradora gerencia todo o fluxo de aprovações, estoque, horários e promoções.

### 1.1 Atores do Sistema

| Ator | Descrição | Identificação |
|------|-----------|---------------|
| **Cliente** | Usuário final que agenda serviços e compra produtos | Qualquer e-mail cadastrado |
| **Gestora (Admin)** | Proprietária/gerente da clínica | E-mail `admin@poar.com` |

### 1.2 Tecnologias Utilizadas

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | HTML5 + CSS3 + JS Vanilla | Sem framework, menor curva, apto para TCC |
| Autenticação | Firebase Authentication | Seguro, gratuito, gerenciado |
| Banco de Dados | Cloud Firestore (NoSQL) | Real-time, escalável, sem servidor |
| Armazenamento | Firebase Storage | Imagens de serviços, produtos e perfis |
| Notificações | WAHA (WhatsApp API) | Comunicação via WhatsApp com clientes |
| Hospedagem | Vercel | Deploy automático via Git |
| Proxy HTTPS | Vercel Serverless Function | Resolve Mixed Content (WAHA é HTTP) |

---

## 2. Requisitos do Sistema

### 2.1 Requisitos Funcionais

| ID | Requisito | Ator | Prioridade |
|----|-----------|------|-----------|
| RF01 | Cadastro de usuário com nome, e-mail, senha e telefone (WhatsApp obrigatório) | Cliente | Alta |
| RF02 | Login com e-mail e senha | Ambos | Alta |
| RF03 | Perfil com foto editável | Cliente | Média |
| RF04 | Agendamento de serviços via calendário interativo | Cliente | Alta |
| RF05 | Fluxo de aprovação de agendamentos (pendente → confirmado/cancelado) | Gestora | Alta |
| RF06 | Catálogo de serviços e produtos com busca e filtros | Cliente | Alta |
| RF07 | Compra de produtos com controle de estoque | Cliente | Alta |
| RF08 | Notificação via WhatsApp na confirmação/cancelamento | Ambos | Alta |
| RF09 | Gestão de serviços (CRUD com imagem) | Gestora | Alta |
| RF10 | Gestão de produtos com dois tipos de estoque (quantidade/requisição) | Gestora | Alta |
| RF11 | Alertas de estoque baixo | Gestora | Média |
| RF12 | Configuração de disponibilidade por dia da semana | Gestora | Alta |
| RF13 | Bloqueio de datas específicas (feriados, folgas) | Gestora | Média |
| RF14 | Sistema de promoções de fidelidade (faça X → ganhe Y) | Gestora | Média |
| RF15 | Progresso de promoções visível para o cliente | Cliente | Média |
| RF16 | Aprovação/rejeição de pedidos de produtos | Gestora | Alta |
| RF17 | Motivo obrigatório para cancelamentos com notificação ao cliente | Gestora | Alta |
| RF18 | Solicitação de notificação quando produto esgotado volta ao estoque | Cliente | Baixa |
| RF19 | Personalização do logo e banner da página inicial | Gestora | Baixa |
| RF20 | Atualização em tempo real via Firestore onSnapshot | Ambos | Alta |

### 2.2 Requisitos Não-Funcionais

| ID | Requisito | Tipo |
|----|-----------|------|
| RNF01 | Interface mobile-first responsiva (funciona em celular e desktop) | Usabilidade |
| RNF02 | Carregamento com skeleton loaders (sem tela em branco) | Desempenho |
| RNF03 | Animações suaves (stagger-in, transitions 250ms) | Usabilidade |
| RNF04 | Segurança: apenas admin@poar.com acessa o painel de gestão | Segurança |
| RNF05 | Comunicação segura via HTTPS (Vercel) com proxy para WAHA | Segurança |
| RNF06 | Deploy contínuo no Vercel a partir do repositório Git | Manutenibilidade |
| RNF07 | Feedback visual em todas as ações (toasts, loading buttons) | Usabilidade |
| RNF08 | Dados sincronizados em tempo real entre sessões abertas | Consistência |

---

## 3. Arquitetura do Sistema

### 3.1 Visão em Camadas

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTE (Browser)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │index.html│ │agendar   │ │catalogo  │ │login /   │   │
│  │(Home)    │ │.html     │ │.html     │ │gestao    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │
│       │             │             │             │         │
│  ┌────┴─────────────┴─────────────┴─────────────┴─────┐  │
│  │               app.js (UI Logic)                     │  │
│  │  updateNavState · skeletonLoaders · renderHelpers   │  │
│  └────────────────────────┬────────────────────────────┘  │
│                           │                               │
│  ┌────────────────────────┴────────────────────────────┐  │
│  │           firebase-config.js (Data Layer)            │  │
│  │  Auth · Firestore CRUD · Storage · WAHA · onSnapshot│  │
│  └────────────────────────┬────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────┘
                            │ HTTPS
           ┌────────────────┼────────────────┐
           │                │                │
    ┌──────┴──────┐  ┌──────┴──────┐  ┌─────┴──────┐
    │  Firebase   │  │  Firebase   │  │  Vercel    │
    │    Auth     │  │  Firestore  │  │ /api/waha  │
    │             │  │  + Storage  │  │ (proxy)    │
    └─────────────┘  └─────────────┘  └─────┬──────┘
                                            │ HTTP
                                     ┌──────┴──────┐
                                     │    WAHA     │
                                     │ (WhatsApp)  │
                                     └─────────────┘
```

### 3.2 Estrutura de Arquivos

```
PoarEstetica/
├── index.html          # Página inicial (Home)
├── agendar.html        # Calendário e fluxo de agendamento
├── catalogo.html       # Catálogo de serviços e produtos
├── login.html          # Login, cadastro e perfil do usuário
├── gestao.html         # Painel administrativo (admin only)
├── app.js              # Lógica de UI compartilhada
├── firebase-config.js  # Configuração Firebase + todas as funções de dados
├── style.css           # Design system completo (variáveis CSS, componentes)
└── api/
    └── waha.js         # Serverless function (proxy HTTPS → WAHA HTTP)
```

---

## 4. Diagrama de Casos de Uso

```
┌─────────────────────────────────────────────────────────────────┐
│                    Sistema Poar Estética                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      <<include>>                         │    │
│  │                                                          │    │
│  │  [UC01] Cadastrar conta ────────────────────────────────┤    │
│  │  [UC02] Fazer login                                      │    │
│  │  [UC03] Editar perfil / foto                             │    │
│  │  [UC04] Ver catálogo (serviços e produtos)               │    │
│  │  [UC05] Agendar serviço ──────► [UC14] Receber notif.   │    │
│  │  [UC06] Comprar produto ──────► [UC14]                   │    │
│  │  [UC07] Ver progresso de promoções                       │    │
│  │  [UC08] Solicitar notif. estoque esgotado                │    │
│  └──────────────────────────────────────────────────────────┘   │
│               ▲                                                  │
│           <<extends>>                                            │
│               │                                                  │
│   ┌──────── CLIENTE ────────┐                                    │
│                                                                  │
│   ┌──────── GESTORA ────────┐                                    │
│               │                                                  │
│           <<extends>>                                            │
│               ▼                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  [UC09]  Aprovar/rejeitar agendamentos                    │   │
│  │  [UC10]  Aprovar/rejeitar pedidos de produtos             │   │
│  │  [UC11]  Gerenciar serviços (CRUD + imagem)               │   │
│  │  [UC12]  Gerenciar produtos (CRUD + estoque)              │   │
│  │  [UC13]  Configurar horários e datas bloqueadas           │   │
│  │  [UC14]  Enviar notificações WhatsApp ◄── [UC05] [UC06]  │   │
│  │  [UC15]  Criar e gerenciar promoções                      │   │
│  │  [UC16]  Visualizar agenda completa (com filtros)         │   │
│  │  [UC17]  Personalizar logo e banner                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Diagrama de Classes

> Os "modelos" do sistema são os documentos do Firestore. Abaixo representamos como classes com atributos e métodos.

```
┌─────────────────────────────────────┐
│               Usuario               │
├─────────────────────────────────────┤
│ + uid: string (PK)                  │
│ + email: string                     │
│ + name: string                      │
│ + phone: string                     │
│ + role: 'cliente' | 'gestao'        │
│ + profileImage: string (URL)        │
│ + createdAt: Timestamp              │
├─────────────────────────────────────┤
│ + login(email, password): User      │
│ + register(email, pw, name, phone)  │
│ + updateProfile(data): void         │
│ + logout(): void                    │
└────────────┬────────────────────────┘
             │ 1
             │ faz
             ▼ *
┌────────────────────────────┐        ┌────────────────────────────┐
│         Agendamento        │        │         Pedido Produto      │
├────────────────────────────┤        ├────────────────────────────┤
│ + id: string (PK)          │        │ + id: string (PK)           │
│ + serviceId: string (FK)   │        │ + productId: string (FK)    │
│ + serviceName: string      │        │ + productName: string       │
│ + date: string (YYYY-MM-DD)│        │ + quantity: number          │
│ + time: string (HH:MM)     │        │ + unitPrice: number         │
│ + duration: number (min)   │        │ + totalPrice: number        │
│ + prepTime: number (min)   │        │ + clientName: string        │
│ + price: number            │        │ + clientEmail: string (FK)  │
│ + clientName: string       │        │ + clientPhone: string       │
│ + clientEmail: string (FK) │        │ + clientUid: string (FK)    │
│ + clientPhone: string      │        │ + deliveryTime: string      │
│ + clientUid: string (FK)   │        │ + status: enum              │
│ + status: enum             │        │ + cancelReason: string      │
│ + cancelReason: string     │        │ + createdAt: Timestamp      │
│ + createdAt: Timestamp     │        ├────────────────────────────┤
├────────────────────────────┤        │ + create(data): void        │
│ + create(data): void       │        │ + approve(): void           │
│ + approve(): void          │        │ + reject(reason): void      │
│ + cancel(reason): void     │        └──────────────┬─────────────┘
└──────────────┬─────────────┘                       │ refere-se
               │ refere-se                           ▼ *
               ▼ *               ┌────────────────────────────────┐
┌──────────────────────────────┐ │             Produto            │
│            Serviço           │ ├────────────────────────────────┤
├──────────────────────────────┤ │ + id: string (PK)              │
│ + id: string (PK)            │ │ + name: string                 │
│ + name: string               │ │ + description: string          │
│ + description: string        │ │ + price: number                │
│ + price: number              │ │ + image: string (URL)          │
│ + image: string (URL)        │ │ + stockType: 'quantidade'      │
│ + duration: number (min)     │ │               | 'requisicao'   │
│ + prepTime: number (min)     │ │ + stockQuantity: number        │
│ + createdAt: Timestamp       │ │ + stockAlert: number           │
├──────────────────────────────┤ │ + deliveryTime: string         │
│ + create(data): void         │ │ + createdAt: Timestamp         │
│ + update(data): void         │ ├────────────────────────────────┤
│ + delete(): void             │ │ + create(data): void           │
└──────────────────────────────┘ │ + update(data): void           │
                                 │ + delete(): void               │
                                 └────────────────────────────────┘

┌─────────────────────────────────────┐
│             Disponibilidade         │
├─────────────────────────────────────┤
│ + dayOfWeek: 0..6 (PK/ID)          │
│ + enabled: boolean                  │
│ + period: 'manha'|'tarde'|'ambos'  │
│ + startTime: string (HH:MM)         │
│ + endTime: string (HH:MM)           │
│ + lunchStart: string (HH:MM)        │
│ + lunchEnd: string (HH:MM)          │
├─────────────────────────────────────┤
│ + set(day, data): void              │
│ + generateSlots(): string[]         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│              Promoção               │
├─────────────────────────────────────┤
│ + id: string (PK)                   │
│ + requiredType: 'servico'|'produto' │
│ + requiredTargetId: string (FK)     │
│ + requiredTargetName: string        │
│ + requiredCount: number             │
│ + rewardType: 'servico'|'produto'   │
│ + rewardTargetId: string (FK)       │
│ + rewardTargetName: string          │
│ + description: string               │
│ + active: boolean                   │
│ + createdAt: Timestamp              │
├─────────────────────────────────────┤
│ + create(data): void                │
│ + activate(): void                  │
│ + deactivate(): void                │
│ + delete(): void                    │
│ + getClientProgress(email): number  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│        DataBloqueada                │
├─────────────────────────────────────┤
│ + date: string (YYYY-MM-DD) (PK)   │
│ + reason: string                    │
├─────────────────────────────────────┤
│ + add(date, reason): void           │
│ + remove(date): void                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│      NotificacaoEstoque             │
├─────────────────────────────────────┤
│ + id: string (PK)                   │
│ + productId: string (FK)            │
│ + productName: string               │
│ + clientName: string                │
│ + clientEmail: string               │
│ + clientPhone: string               │
│ + notified: boolean                 │
│ + createdAt: Timestamp              │
├─────────────────────────────────────┤
│ + add(data): void                   │
│ + markNotified(): void              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│            ConfigSite               │
├─────────────────────────────────────┤
│ + heroTitle: string                 │
│ + heroSubtitle: string              │
│ + heroTag: string                   │
│ + heroBackground: string (URL)      │
│ + logoImage: string (URL)           │
│ + logoText: string                  │
│ + logoFontSize: string              │
│ + logoFontStyle: string             │
├─────────────────────────────────────┤
│ + get(): ConfigSite                 │
│ + update(data): void                │
└─────────────────────────────────────┘
```

---

## 6. Modelo de Banco de Dados

> O Firestore é um banco de dados NoSQL orientado a documentos. Cada **coleção** contém **documentos** com campos flexíveis.

### 6.1 Coleções e Estrutura

---

#### Coleção: `users`
> **Documento ID:** `{uid}` (gerado pelo Firebase Auth)

```json
{
  "uid": "abc123",
  "email": "cliente@email.com",
  "name": "Maria Silva",
  "phone": "(11) 91234-5678",
  "role": "cliente",
  "profileImage": "https://storage.firebase.../foto.jpg",
  "createdAt": "Timestamp"
}
```
> role pode ser `"cliente"` ou `"gestao"`. Determinado automaticamente no cadastro pelo e-mail.

---

#### Coleção: `services`
> **Documento ID:** gerado automaticamente

```json
{
  "name": "Limpeza de Pele",
  "description": "Limpeza profunda com extração e hidratação.",
  "price": 120.00,
  "duration": 60,
  "prepTime": 15,
  "image": "https://...",
  "createdAt": "Timestamp"
}
```
> `duration` → visível ao cliente (tempo do procedimento)  
> `prepTime` → oculto ao cliente (bloqueia agenda entre atendimentos)

---

#### Coleção: `products`
> **Documento ID:** gerado automaticamente

```json
{
  "name": "Protetor Solar FPS50",
  "description": "Proteção solar de alta performance.",
  "price": 89.90,
  "image": "https://...",
  "stockType": "quantidade",
  "stockQuantity": 10,
  "stockAlert": 3,
  "deliveryTime": "",
  "createdAt": "Timestamp"
}
```
> `stockType` = `"quantidade"`: produto físico em estoque  
> `stockType` = `"requisicao"`: produto sob encomenda, sem limite de estoque

---

#### Coleção: `bookings`
> **Documento ID:** gerado automaticamente

```json
{
  "serviceId": "svc_abc",
  "serviceName": "Limpeza de Pele",
  "date": "2026-05-10",
  "time": "14:00",
  "duration": 60,
  "prepTime": 15,
  "price": 120.00,
  "clientName": "Maria Silva",
  "clientEmail": "cliente@email.com",
  "clientPhone": "(11) 91234-5678",
  "clientUid": "abc123",
  "status": "pendente",
  "cancelReason": "",
  "createdAt": "Timestamp"
}
```
> **status:** `pendente` → `confirmado` | `cancelado`

---

#### Coleção: `productOrders`
> **Documento ID:** gerado automaticamente

```json
{
  "productId": "prod_xyz",
  "productName": "Protetor Solar FPS50",
  "quantity": 2,
  "unitPrice": 89.90,
  "totalPrice": 179.80,
  "clientName": "Maria Silva",
  "clientEmail": "cliente@email.com",
  "clientPhone": "(11) 91234-5678",
  "clientUid": "abc123",
  "deliveryTime": "",
  "status": "pendente",
  "cancelReason": "",
  "createdAt": "Timestamp"
}
```
> **status:** `pendente` → `aprovado` | `cancelado`

---

#### Coleção: `availability`
> **Documento ID:** `"0"` a `"6"` (dia da semana, 0=Domingo)

```json
{
  "enabled": true,
  "period": "ambos",
  "startTime": "08:00",
  "endTime": "18:00",
  "lunchStart": "12:00",
  "lunchEnd": "13:00"
}
```
> `period` = `"manha"` | `"tarde"` | `"ambos"`

---

#### Coleção: `blockedDates`
> **Documento ID:** `"YYYY-MM-DD"` (a própria data)

```json
{
  "date": "2026-12-25",
  "reason": "Natal - feriado"
}
```

---

#### Coleção: `promotions`
> **Documento ID:** gerado automaticamente

```json
{
  "requiredType": "servico",
  "requiredTargetId": "svc_abc",
  "requiredTargetName": "Limpeza de Pele",
  "requiredCount": 5,
  "rewardType": "servico",
  "rewardTargetId": "svc_xyz",
  "rewardTargetName": "Massagem Relaxante",
  "description": "Faça 5 Limpezas de Pele e ganhe 1 Massagem Relaxante grátis!",
  "active": true,
  "createdAt": "Timestamp"
}
```

---

#### Coleção: `siteConfig`
> **Documento ID:** `"general"` (único documento)

```json
{
  "heroTitle": "A sua Beleza, Elevada",
  "heroSubtitle": "Cuidados essenciais para sua pele radiante",
  "heroTag": "Bem-vinda",
  "heroBackground": "https://...",
  "logoImage": "",
  "logoText": "P",
  "logoFontSize": "medio",
  "logoFontStyle": "normal"
}
```

---

#### Coleção: `stockNotifications`
> **Documento ID:** gerado automaticamente

```json
{
  "productId": "prod_xyz",
  "productName": "Protetor Solar FPS50",
  "clientName": "Maria Silva",
  "clientEmail": "cliente@email.com",
  "clientPhone": "(11) 91234-5678",
  "notified": false,
  "createdAt": "Timestamp"
}
```

### 6.2 Índices Compostos Necessários (Firestore)

| Coleção | Campo 1 | Campo 2 | Tipo |
|---------|---------|---------|------|
| bookings | clientEmail (==) | date (asc) | Composto |
| bookings | date (==) | status (in) | Composto |
| productOrders | clientEmail (==) | createdAt (desc) | Composto |
| bookings | clientEmail (==) | serviceId (==) | Composto |
| productOrders | clientEmail (==) | productId (==) | Composto |

---

## 7. Diagramas de Fluxo

### 7.1 Fluxo de Autenticação

```
         INÍCIO
            │
            ▼
    ┌───────────────┐
    │ Abre login.   │
    │ html          │
    └───────┬───────┘
            │
            ▼
    ┌───────────────┐    NÃO
    │ Já está       ├──────────► Exibe formulário de login
    │ logado?       │                       │
    └───────┬───────┘                       │ Preenche e-mail/senha
            │ SIM                           │
            ▼                               ▼
    ┌───────────────┐            ┌───────────────────┐
    │ Carrega perfil│            │ loginUser()        │
    │ do Firestore  │            │ Firebase Auth      │
    └───────┬───────┘            └─────────┬─────────┘
            │                             │
            ▼                    ┌────────┴────────┐
    ┌───────────────┐            │                 │
    │ role=gestao?  │        SUCESSO           ERRO
    └───────┬───────┘            │                 │
            │                    ▼                 ▼
       SIM  │  NÃO      ┌──────────────┐   Toast de erro
            │  │        │ role=gestao? │
            ▼  ▼        └──────┬───────┘
     gestao  login             │
     .html   profile    SIM ───┤─── NÃO
                               │        │
                               ▼        ▼
                         gestao.html  perfil
                                      do
                                     cliente
```

### 7.2 Fluxo de Agendamento (Cliente)

```
     agendar.html
          │
          ▼
   ┌─────────────┐
   │ Calendário  │◄──── Carrega: availability + blockedDates + services
   │ renderizado │
   └──────┬──────┘
          │ Clica num dia disponível
          ▼
   ┌─────────────┐
   │ Bottom sheet│◄──── Carrega: bookings do dia selecionado
   │ com horários│      Gera slots (respeita almoço)
   └──────┬──────┘      Bloqueia slots conflitantes (duration+prepTime)
          │ Seleciona horário
          ▼
   ┌─────────────┐
   │ Bottom sheet│      Para cada serviço mostra:
   │ com serviços│      • disponível ✅
   └──────┬──────┘      • indisponível ❌ + motivo
          │ Seleciona serviço
          ▼
   ┌──────────────┐
   │  Logado?     │
   └──────┬───────┘
          │ NÃO          SIM
          │──────────────────┐
          │                  ▼
          ▼        ┌────────────────────┐
   Prompt login    │ Modal de confirmação│
                   │ • Resumo do serviço │
                   │ • Data e horário    │
                   │ • Valor             │
                   │ • Telefone WhatsApp │
                   │   (editável)        │
                   └──────────┬─────────┘
                              │ Confirmar
                              ▼
                   ┌────────────────────┐
                   │ addBooking()       │
                   │ status: "pendente" │
                   └──────────┬─────────┘
                              │
                              ▼
                   ┌────────────────────┐
                   │ Tela: Pedido        │
                   │ marcado! ⏳         │
                   │ Aguardando aprovação│
                   └────────────────────┘
```

### 7.3 Fluxo de Aprovação de Agendamento (Gestora)

```
    gestao.html → Aba "Aprovações"
             │
             │ Carrega bookings com status="pendente"
             ▼
    ┌─────────────────────┐
    │ Lista de pendências  │
    │  ┌─────────────────┐ │
    │  │ Cliente: Maria  │ │
    │  │ Limpeza de Pele │ │
    │  │ 10/05 às 14:00  │ │
    │  │ [✓ Aprovar] [✗] │ │
    │  └─────────────────┘ │
    └──────────┬──────────┘
               │
         ┌─────┴──────┐
         │             │
      APROVAR       REJEITAR
         │             │
         ▼             ▼
  updateBooking   Modal: Motivo
  status=         obrigatório
  "confirmado"        │
         │             ▼
         │      updateBooking
         │      status="cancelado"
         │      cancelReason=...
         │             │
         └──────┬──────┘
                │
                ▼
       sendWhatsApp(phone, msg)
       • Envia para variação COM e SEM dígito 9
       • Via proxy Vercel → WAHA → WhatsApp
```

### 7.4 Fluxo de Compra de Produto

```
    catalogo.html
          │
          ▼
   ┌─────────────┐
   │ Grid de     │
   │ produtos    │
   └──────┬──────┘
          │ Clica no produto
          ▼
   ┌─────────────┐
   │  Estoque?   │
   └──────┬──────┘
          │
     ┌────┴──────┬──────────────┐
     │           │              │
   SIM (qty)  ESGOTADO   SOB ENCOMENDA
     │           │              │
     ▼           ▼              ▼
  Seletor    "Notificar     Seletor
  quantidade  quando         quantidade
  + Comprar   disponível"    + Comprar
     │           │              │
     │       addStockNoti-       │
     │       fication()         │
     │                          │
     └──────────┬───────────────┘
                │ Clicar "Comprar"
                ▼
       ┌─────────────────┐
       │  Está logado?   │
       └────────┬────────┘
                │
           SIM  │  NÃO
                │  └──► Modal: Faça login
                ▼
       ┌─────────────────┐
       │ addProductOrder()│
       │ status: pendente │
       │                  │
       │ Se qty stock:    │
       │ decrementar qty  │
       └─────────────────┘
                │
                ▼
       Toast: Pedido realizado!
       (admin aprova depois)
```

### 7.5 Fluxo de Promoções

```
  GESTORA cria promoção:
  ┌──────────────────────────────┐
  │ "O cliente precisa:"         │
  │  Tipo: Serviço               │
  │  Qual: Limpeza de Pele       │
  │  Quantas vezes: 5            │
  │                              │
  │ "O cliente ganha:"           │
  │  Tipo: Serviço               │
  │  Qual: Massagem Relaxante    │
  └──────────────────────────────┘
                │
                ▼
  addPromotion() → active: true

  CLIENTE vê progresso:
  ┌──────────────────────────────┐
  │ 🎁 Limpeza de Pele           │
  │ Faça 5x e ganhe Massagem!    │
  │ ████████░░  3 de 5           │
  │ Faltam 2 para ganhar!        │
  └──────────────────────────────┘

  Cálculo: getClientPromotionProgress()
  conta bookings/orders com status
  confirmado ou pendente para o serviço/produto
```

---

## 8. Diagramas de Sequência

### 8.1 Sequência: Agendamento Completo

```
Cliente    Browser     Firebase     Firestore     WAHA
   │           │         Auth          DB          API
   │           │           │            │            │
   │──clica────►           │            │            │
   │   calendário          │            │            │
   │           │──getAvailability()────►│            │
   │           │◄──{dayConfigs}─────────│            │
   │           │──getBlockedDates()────►│            │
   │           │◄──{blocked[]}──────────│            │
   │           │──getServices()────────►│            │
   │           │◄──{services[]}─────────│            │
   │           │                        │            │
   │──seleciona►           │            │            │
   │   dia/hora│           │            │            │
   │           │──getBookingsByDate()──►│            │
   │           │◄──{bookings[]}─────────│            │
   │           │──[calcula slots]        │            │
   │           │                        │            │
   │──confirma─►           │            │            │
   │           │──addBooking(data)──────►│            │
   │           │◄──{bookingId}───────────│            │
   │           │                        │            │
   │◄──success─│           │            │            │
   │  "Pedido  │           │            │            │
   │  marcado!"│           │            │            │
   │           │           │            │            │
   │  [Admin aprova]        │            │            │
   │           │──updateBookingStatus()►│            │
   │           │   status='confirmado'  │            │
   │           │                        │            │
   │           │──sendWhatsApp()────────────────────►│
   │           │   chatId: 5511912345@c.us           │
   │           │   text: "Confirmado!"               │
   │           │◄──200 OK────────────────────────────│
   │           │──sendWhatsApp()─(sem 9)────────────►│
   │           │◄──200 OK────────────────────────────│
   │           │           │            │            │
   │◄─WhatsApp─────────────────────────────────────  │
   │  mensagem │           │            │            │
```

### 8.2 Sequência: Real-time onSnapshot (gestao.html)

```
Navegador    Firestore    UI(gestao)
    │             │            │
    │──subscribe──►            │
    │  onSnapshot              │
    │  (bookings)              │
    │             │            │
    │  [outro cliente faz      │
    │   agendamento]           │
    │             │            │
    │◄──snapshot──│            │
    │   {new doc} │            │
    │─────────────────────────►│
    │             │   updateCachedBookings()
    │             │   rerenderActiveTab()
    │             │            │──▶ badge "2 pendentes"
    │             │            │──▶ lista atualiza
```

---

## 9. Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────┐
│                  Aplicação Frontend                      │
│                                                          │
│  ┌─────────────────────┐   ┌─────────────────────────┐  │
│  │     app.js          │   │   firebase-config.js    │  │
│  │  ┌───────────────┐  │   │  ┌───────────────────┐  │  │
│  │  │ initAuth()    │  │   │  │ Auth Module       │  │  │
│  │  │ updateNav()   │  │   │  │  loginUser()      │  │  │
│  │  │ showToast()   │  │   │  │  registerUser()   │  │  │
│  │  │ openModal()   │  │   │  │  onAuthChange()   │  │  │
│  │  │ skeletons()   │  │   │  └───────────────────┘  │  │
│  │  │ renderHome*() │  │   │  ┌───────────────────┐  │  │
│  │  │ applyLogo()   │  │   │  │ Firestore Module  │  │  │
│  │  │ applyHero()   │  │   │  │  getServices()    │  │  │
│  │  │ renderPromos()│  │   │  │  addBooking()     │  │  │
│  │  └───────────────┘  │   │  │  updateProduct()  │  │  │
│  └─────────────────────┘   │  │  onSnapshot()     │  │  │
│                             │  └───────────────────┘  │  │
│  ┌──────────────────────┐  │  ┌───────────────────┐  │  │
│  │     style.css        │  │  │ Storage Module    │  │  │
│  │  Design System       │  │  │  uploadImage()    │  │  │
│  │  CSS Variables       │  │  │  pickAndUpload()  │  │  │
│  │  Mobile-first        │  │  └───────────────────┘  │  │
│  │  Skeleton loaders    │  │  ┌───────────────────┐  │  │
│  │  Stagger animations  │  │  │ WAHA Module       │  │  │
│  └──────────────────────┘  │  │  sendWhatsApp()   │  │  │
│                             │  │  getVariations()  │  │  │
│  ┌──────────────────────┐  │  └───────────────────┘  │  │
│  │   Páginas HTML       │  └─────────────────────────┘  │
│  │  index.html  ────────┼──────► renderHomeServices()   │
│  │  agendar.html────────┼──────► generateTimeSlots()    │
│  │  catalogo.html───────┼──────► renderCatalog()        │
│  │  login.html  ────────┼──────► showProfilePage()      │
│  │  gestao.html ────────┼──────► refreshAll()           │
│  └──────────────────────┘       setupRealtimeListeners()│
└─────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  Firebase Cloud │    │  Firebase Cloud  │    │    Vercel    │
│  Auth           │    │  Firestore +     │    │  /api/waha   │
│  (Autenticação) │    │  Storage         │    │  (Proxy)     │
└─────────────────┘    └─────────────────┘    └──────┬───────┘
                                                      │ HTTP
                                               ┌──────┴───────┐
                                               │     WAHA     │
                                               │  WhatsApp    │
                                               └──────────────┘
```

---

## 10. Descrição das Telas

### 10.1 Tela Inicial — `index.html`

| Elemento | Descrição |
|----------|-----------|
| Header | Logo (editável pelo admin), nome da empresa, nav desktop, botão de login |
| Hero Banner | Imagem de fundo, tag, título e subtítulo (editáveis pelo admin via upload/texto) |
| Seção Promoções | Barra de progresso das promoções do cliente logado |
| Scroll de Serviços | Cards horizontais com imagem, nome, tempo e preço. Admin vê badge de edição (✏️) |
| Scroll de Produtos | Cards horizontais com imagem, nome e preço. Admin vê badge de edição (✏️) |
| FAB WhatsApp | Botão flutuante de contato |
| Bottom Nav | Início · Agendar · Catálogo · Entrar (mobile) |

### 10.2 Tela de Agendamento — `agendar.html`

| Elemento | Descrição |
|----------|-----------|
| Badge de agendamentos | Indicador com quantidade de agendamentos ativos |
| Seção "Seus Agendamentos" | Lista dos agendamentos do cliente com status (Pendente/Confirmado/Recusado + motivo) |
| Calendário | Mês navegável. Dias habilitados clicáveis, dias passados/bloqueados cinzas |
| Modal Horários | Grid de slots de 30min. Slots bloqueados (conflito/lotado) indicados |
| Modal Serviços | Lista de serviços disponíveis no horário. Motivo de indisponibilidade quando aplicável |
| Modal Confirmação | Resumo completo + campo de telefone editável + aviso de aprovação pendente |

### 10.3 Tela Catálogo — `catalogo.html`

| Elemento | Descrição |
|----------|-----------|
| Busca | Input de pesquisa em tempo real por nome e descrição |
| Filtros | Chips: Todos · Serviços · Produtos |
| Promoções | Barras de progresso das promoções ativas (para clientes logados) |
| Grid de Cards | Serviços e produtos com badges de estoque, promoção e edição (admin) |
| Modal Detalhe | Imagem, nome, descrição, preço, tempo, badge de estoque, barra de promoção, seletor de quantidade |
| Fluxo esgotado | Em vez de "Comprar", botão de notificação WhatsApp quando o produto voltar |

### 10.4 Tela Login/Perfil — `login.html`

| Elemento | Descrição |
|----------|-----------|
| Formulário login | E-mail + senha + botão entrar |
| Modal Cadastro | Nome + e-mail + senha + WhatsApp (obrigatório) |
| Perfil | Foto (editável), nome, e-mail, telefone, agendamentos ativos, progresso de promoções |
| Perfil Admin | Mostra botão "Painel de Gestão" |
| Modal editar perfil | Nome e telefone editáveis |
| Modal editar logo | (Admin) upload de imagem, texto, tamanho e estilo da fonte |

### 10.5 Painel de Gestão — `gestao.html`

| Aba | Descrição |
|-----|-----------|
| **Resumo** | Cards com métricas (pendentes, confirmados, serviços, produtos, pedidos) e próximos agendamentos |
| **Aprovações** | Lista de agendamentos e pedidos de produto pendentes. Aprovar/Rejeitar com motivo obrigatório + WhatsApp |
| **Serviços** | Formulário de criação + lista com edição inline (modal completo) e exclusão |
| **Produtos** | Formulário com tipo de estoque (quantidade/requisição) + alertas de estoque baixo + edição/exclusão |
| **Horários** | Grade de dias da semana com ativação, atalhos Manhã/Tarde/Ambos, horários configuráveis + datas bloqueadas |
| **Promoções** | Criação de promoções (faça X → ganhe Y) + lista com ativar/desativar/excluir |
| **Agenda** | Todos os agendamentos (padrão sem filtro). Filtro por data. Status coloridos. Cancelamento com motivo |

---

## 11. Heurísticas IHC Aplicadas

> Baseado nas 10 Heurísticas de Jakob Nielsen (ISO 9241-110)

| # | Heurística | Aplicação no Sistema |
|---|-----------|---------------------|
| 1 | **Visibilidade do status** | Skeleton loaders, status badges coloridos (pendente=amarelo, confirmado=verde, cancelado=vermelho), spinner em botões durante ações |
| 2 | **Correspondência com o mundo real** | Linguagem em português informal ("Bem-vinda", "Confirmar"), ícones intuitivos (📅 agendar, 🛍️ comprar, 🎁 promoção) |
| 3 | **Controle e liberdade** | Todos os modais têm "Cancelar" ou "✕ fechar". Ações destrutivas pedem confirmação |
| 4 | **Consistência e padrões** | Design system único (CSS variables), bottom sheets em mobile / dialogs em desktop, mesma paleta e tipografia |
| 5 | **Prevenção de erros** | Horários conflitantes bloqueados com motivo explicado, validação de formulários, telefone obrigatório antes de agendar |
| 6 | **Reconhecimento em vez de lembrança** | Resumo do agendamento visível na confirmação, badges de estoque visíveis nos cards, progresso de promoção com barra |
| 7 | **Flexibilidade e eficiência** | Atalhos admin (Manhã/Tarde/Ambos nos horários), busca em tempo real no catálogo, atualização real-time (sem F5) |
| 8 | **Design estético e minimalista** | Paleta sutil (tons terrosos/rose), sem informações desnecessárias, cards limpos com hierarquia clara |
| 9 | **Recuperação de erros** | Toasts com mensagens claras de erro, motivo do cancelamento enviado ao cliente, razão de indisponibilidade de horário |
| 10 | **Ajuda e documentação** | Hints explicativos nos formulários (prepTime "oculto do cliente"), dica de aprovação pendente antes de confirmar agendamento |

---

## Glossário

| Termo | Definição |
|-------|-----------|
| **prepTime** | Tempo de preparação de um serviço. Não visível ao cliente, mas bloqueia a agenda após o atendimento |
| **Bottom Sheet** | Painel que desliza de baixo para cima (padrão mobile para modais/menus) |
| **onSnapshot** | Listener do Firestore que dispara automaticamente quando dados mudam no banco (real-time) |
| **WAHA** | WhatsApp HTTP API — serviço que permite envio de mensagens WhatsApp via requisições HTTP |
| **Mixed Content** | Erro do browser que bloqueia chamadas HTTP a partir de páginas HTTPS |
| **Serverless Function** | Função hospedada no Vercel que executa código backend sem servidor dedicado |
| **Stagger Animation** | Animação onde elementos aparecem em sequência (um após o outro) ao carregar |
| **Skeleton Loader** | Placeholder animado que substitui o conteúdo enquanto está carregando |
| **role** | Campo que define o tipo do usuário: `"cliente"` ou `"gestao"` |
| **stockType** | Define o modelo de estoque do produto: `"quantidade"` (físico) ou `"requisicao"` (encomenda) |

---

*Documentação gerada automaticamente a partir do código-fonte do sistema — Poar Estética v1.0*
