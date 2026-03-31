# RepoLens Core: Codebase Overview

RepoLens Core is an AI-powered requirements engineering and codebase analysis platform.

## 🏗️ System Architecture

![System Architecture](architecture_diagram.png)

### System Context Diagram (Level 1)

```mermaid
graph TD
    subgraph "RepoLens Core System"
        RL[RepoLens Core Platform]
    end

    %% External Actors
    User[Product Leader / Developer]
    GitHub[GitHub / GitLab]
    OpenAI[OpenAI AI Service]
    Storage[Cloud/Local Storage]

    %% Interactions
    User -- "Manages projects, views reports" --> RL
    RL -- "Clones repositories" --> GitHub
    RL -- "Webhooks / Status updates" --> GitHub
    RL -- "Summarization & Embeddings" --> OpenAI
    RL -- "Stores blobs & ASTs" --> Storage

    %% Styling
    classDef system fill:#2d3436,stroke:#00cec9,stroke-width:2px,color:#fff;
    classDef external fill:#636e72,stroke:#b2bec3,stroke-width:1px,color:#fff;
    
    class RL system;
    class User,GitHub,OpenAI,Storage external;
```

### System Container Diagram (Level 2)

```mermaid
graph TB
    subgraph "RepoLens Core System Boundary"
        WebApp[Web Application<br/>Next.js / React]
        API[API Application<br/>NestJS / Node.js]
        Workers[Background Workers<br/>BullMQ Node.js]
        
        subgraph "Data Storage"
            PostgreSQL[Main Database<br/>PostgreSQL]
            VectorStore[Vector Store<br/>pgvector]
            Redis[Queue Store<br/>Redis]
            Storage[Object Store<br/>S3 / Local FS]
        end
    end

    %% External Systems
    GitHub[GitHub / GitLab]
    OpenAI[OpenAI API]

    %% Interactions
    User((User)) -- "Interacts with UI" --> WebApp
    WebApp -- "REST / API Calls" --> API
    API -- "CRUD Operations" --> PostgreSQL
    API -- "Vector Search" --> VectorStore
    API -- "Enqueues Jobs" --> Redis
    API -- "Stores/Reads Files" --> Storage
    
    Workers -- "Processes Jobs" --> Redis
    Workers -- "Parses & Embeds" --> Storage
    Workers -- "Stores Embeddings" --> VectorStore
    Workers -- "AI Extraction/Summaries" --> OpenAI
    
    API -- "Clones Repos" --> GitHub

    %% Styling
    classDef container fill:#2d3436,stroke:#00cec9,stroke-width:2px,color:#fff;
    classDef database fill:#2d3436,stroke:#636e72,stroke-width:1px,color:#fff;
    
    class WebApp,API,Workers container;
    class PostgreSQL,VectorStore,Redis,Storage database;
```

### API Component Diagram (Level 3)

```mermaid
graph TB
    subgraph "NestJS API Component Boundary"
        RC[Requirements Controller]
        PC[Projects Controller]
        SC[Search Controller]
        
        RS[Requirements Service]
        TS[Traceability Service]
        DDS[Drift Detection Service]
        SES[Search Service]
        AS[AI Service]
        
        subgraph "Core Data Services"
            Prisma[Prisma / Database Service]
            S3[S3 / Storage Service]
            Queue[Queue / BullMQ Service]
            PCS[Parser Config Service]
        end
    end

    %% External & Other Containers
    WebApp[Web App]
    Workers[Background Workers]
    DB[(PostgreSQL)]
    AI_API[OpenAI API]

    %% Interactions
    WebApp -- "HTPP/REST" --> PC
    WebApp -- "HTPP/REST" --> RC
    WebApp -- "HTPP/REST" --> SC
    
    RC --> RS
    RS --> TS
    RS --> DDS
    RS --> AS
    RS --> Prisma
    
    SC --> SES
    SES --> AS
    SES --> Prisma
    
    TS --> Prisma
    TS --> S3
    
    AS -- "LLM Calls" --> AI_API
    RS -- "Enqueues Parsing" --> Queue
    Queue -- "BullMQ Jobs" --> Workers
    
    Prisma --> DB

    %% Styling
    classDef component fill:#2d3436,stroke:#00cec9,stroke-width:2px,color:#fff;
    classDef core fill:#2d3436,stroke:#636e72,stroke-width:1px,color:#fff;
    
    class RC,PC,SC,RS,TS,DDS,SES,AS component;
    class Prisma,S3,Queue,PCS core;
```

## 🔄 Core Workflow (Sequence)

```mermaid
sequenceDiagram
    participant U as User
    participant A as API (NestJS)
    participant W as Workers (BullMQ)
    participant DB as Vector DB (pgvector)
    participant AI as AI Service (OpenAI)

    U->>A: Trigger Repository Analysis
    A->>W: Enqueue Parse & Embed Jobs
    
    loop Background Processing
        W->>AI: Generate Summaries & Embeddings
        W->>DB: Store Nodes & Vectors
    end

    U->>A: Search / Match Requirements
    A->>AI: Embed Query
    A->>DB: Semantic Search
    DB-->>A: Return Matches
    A-->>U: Display Results
```

## 🧩 Components and Responsibilities

| Component | Primary Responsibilities | Key Interactions |
| :--- | :--- | :--- |
| **Repository Analysis Engine** | Handles cloning, file discovery, and content deduplication (SHA256). | Provides cleaned source files to the Parsing & Structural Analysis component. |
| **Parsing & Structural Analysis** | Converts files to ASTs (Tree-sitter) and extracts code nodes, symbols, and references. | Supplies structured nodes and dependency graphs to the Semantic Indexing component. |
| **Semantic Indexing** | Generates AI summaries and vector embeddings; manages search indices in PostgreSQL. | Supports the AI Reasoning and Traceability components through semantic retrieval. |
| **AI Reasoning Component** | Handles requirement extraction (LLM), code summarization, and RAG-based analysis. | Consumes semantically retrieved code context and structured requirement data. |
| **Traceability & Drift Detection** | Maintains requirement-to-code links; monitors evolution to detect implementation drift. | Utilizes embeddings and symbol metadata to validate alignment between docs and code. |

## 📂 Project Structure

- `api/`: NestJS backend (Requirements, Search, Workers).
- `frontend/`: Next.js UI.
- `prisma/`: Database schema (PostgreSQL + pgvector).

## 🛠️ Tech Stack

- **Backend**: NestJS, Prisma, BullMQ.
- **Frontend**: Next.js, Tailwind CSS.
- **AI**: OpenAI GPT-4o & Text Embeddings.
- **Database**: PostgreSQL + pgvector.
