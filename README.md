<!-- @format -->

# Rift26 — Pharmacogenomics Analysis Platform

> AI-powered VCF variant analysis for personalized drug-gene interaction insights.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit-blue?style=for-the-badge)](https://rift26-med-frontend.vercel.app/)
[![LinkedIn Video](https://img.shields.io/badge/LinkedIn-Demo%20Video-0A66C2?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/posts/your-linkedin-post-id)

---

## Table of Contents

- [Rift26 — Pharmacogenomics Analysis Platform](#rift26--pharmacogenomics-analysis-platform)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Live Demo](#live-demo)
  - [Architecture Overview](#architecture-overview)
    - [Key Services](#key-services)
    - [Data Files](#data-files)
  - [Tech Stack](#tech-stack)
    - [Backend](#backend)
    - [Frontend](#frontend)
  - [Installation](#installation)
    - [Prerequisites](#prerequisites)
    - [Clone \& Install](#clone--install)
    - [Backend Setup](#backend-setup)
    - [Running in Development](#running-in-development)
  - [Environment Variables](#environment-variables)
  - [API Documentation](#api-documentation)
    - [`POST /api/analyze`](#post-apianalyze)
  - [Usage Examples](#usage-examples)
    - [cURL](#curl)
    - [JavaScript (Fetch)](#javascript-fetch)
    - [Python (requests)](#python-requests)
  - [Team](#team)

---

## Overview

**Rift26** is a clinical pharmacogenomics platform that analyzes a patient's genetic variants (provided as a `.vcf` file) and predicts how their genome affects drug metabolism. Results are expressed as risk levels, clinical recommendations, and AI-generated explanations in both **patient-friendly** and **expert/clinical** language.

Key capabilities:

- Parse standard VCF files and extract relevant genetic variants (RS IDs, star alleles)
- Map variants to genes and phenotypes using a curated rule engine
- Classify metabolizer status (Normal, Intermediate, Poor, Ultra-Rapid)
- Generate risk-stratified clinical recommendations
- Produce natural-language explanations via **Groq Llama 3.3 70B** with per-request caching
- Dual explanation modes: **Patient** (plain language) and **Expert** (CPIC/DPWG citations, pharmacokinetics)

---

## Live Demo

> **[https://rift26-med-frontend.vercel.app/](https://rift26-med-frontend.vercel.app/)**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js 16)                      │
│   - Upload VCF file & select drug                               │
│   - Choose Patient / Expert mode                                │
│   - Display risk level, pharmacogenomic profile, AI explanation │
└───────────────────────────┬─────────────────────────────────────┘
                            │ POST /api/analyze (multipart/form-data)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend (Express 5 / Bun)                    │
│                                                                 │
│  ┌─────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │  VCF Parser │──▶│ Rule Engine  │──▶│  Context Builder   │   │
│  │ vcf.service │   │ruleEngine.svc│   │  context.service   │   │
│  └─────────────┘   └──────────────┘   └────────┬───────────┘   │
│                          │                      │               │
│                    ┌─────▼──────┐        ┌──────▼──────┐       │
│                    │   Cache    │        │ LLM Service  │       │
│                    │ (in-mem)   │        │ (Groq SDK)   │       │
│                    └─────┬──────┘        └──────┬──────┘       │
│                          └──────────┬───────────┘               │
│                                     ▼                           │
│                              JSON Response                      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Services

| Service              | Responsibility                                                                     |
| -------------------- | ---------------------------------------------------------------------------------- |
| `vcf.service`        | Parses raw VCF content into structured variant objects (RS ID, star allele, gene)  |
| `ruleEngine.service` | Evaluates drug–gene–variant maps to produce a phenotype and risk label             |
| `context.service`    | Constructs a structured clinical context object for LLM prompting                  |
| `llm.service`        | Calls Groq API (Llama 3.3 70B) with mode-aware prompts; 8 s timeout                |
| `cache.service`      | In-memory SHA-256 keyed cache (`rsids + drug + mode`) to avoid redundant LLM calls |

### Data Files

| File                    | Contents                                                                 |
| ----------------------- | ------------------------------------------------------------------------ |
| `drug_gene_map.json`    | Maps drug names → primary metabolizing gene                              |
| `gene_variant_map.json` | Maps gene variants (RS IDs / star alleles) → metabolizer phenotype       |
| `phenotype_rules.json`  | Maps phenotypes → risk label, severity, and clinical recommendation text |

---

## Tech Stack

### Backend

| Technology                                    | Version | Role                             |
| --------------------------------------------- | ------- | -------------------------------- |
| [Bun](https://bun.com)                        | 1.3.6+  | Runtime & package manager        |
| [Express](https://expressjs.com)              | 5.x     | HTTP server                      |
| [TypeScript](https://www.typescriptlang.org)  | 5.x     | Type-safe development            |
| [Groq SDK](https://console.groq.com)          | 0.37+   | LLM inference (Llama 3.3 70B)    |
| [Multer](https://github.com/expressjs/multer) | 1.4.x   | VCF file upload (memory storage) |
| [Zod](https://zod.dev)                        | 4.x     | Environment variable validation  |
| [dotenv](https://github.com/motdotla/dotenv)  | 17.x    | Env config loading               |
| [cors](https://github.com/expressjs/cors)     | 2.8.x   | Cross-origin request handling    |

### Frontend

| Technology                              | Version | Role                         |
| --------------------------------------- | ------- | ---------------------------- |
| [Next.js](https://nextjs.org)           | 16.x    | React framework (App Router) |
| [React](https://react.dev)              | 19.x    | UI library                   |
| [Tailwind CSS](https://tailwindcss.com) | 4.x     | Utility-first styling        |
| [shadcn/ui](https://ui.shadcn.com)      | 3.x     | Component library            |
| [Radix UI](https://www.radix-ui.com)    | 1.x     | Accessible primitives        |
| [Lucide React](https://lucide.dev)      | 0.575+  | Icon set                     |

---

## Installation

### Prerequisites

- [Bun](https://bun.com) >= 1.3.6
- A [Groq API key](https://console.groq.com)

### Clone & Install

```bash
git clone https://github.com/halomanlodestar/rift26-med
cd rift26-med
bun install
```

### Backend Setup

```bash
cd backend
cp .env.example .env   # then fill in your GROQ_API_KEY
```

### Running in Development

From the workspace root, run both servers in separate terminals:

```bash
# Frontend — http://localhost:3000
bun web

# Backend — http://localhost:3080
bun server
```

Or run each individually:

```bash
# Backend only
cd backend && bun dev

# Frontend only
cd frontend && bun dev
```

---

## Environment Variables

Create `backend/.env` with the following:

| Variable       | Required | Default       | Description                                               |
| -------------- | -------- | ------------- | --------------------------------------------------------- |
| `GROQ_API_KEY` | Yes      | —             | API key from [console.groq.com](https://console.groq.com) |
| `PORT`         | No       | `3080`        | Port for the Express server                               |
| `NODE_ENV`     | No       | `development` | `development`, `production`, or `test`                    |

---

## API Documentation

### `POST /api/analyze`

Analyzes a VCF file for drug-gene interactions.

**Request** — `multipart/form-data`

| Field  | Type        | Required | Description                                 |
| ------ | ----------- | -------- | ------------------------------------------- |
| `file` | File (.vcf) | Yes      | The patient's VCF file (max 50 MB)          |
| `drug` | string      | Yes      | Drug name (e.g., `clopidogrel`, `warfarin`) |
| `mode` | string      | No       | `"patient"` (default) or `"expert"`         |

**Success Response — `200 OK`**

```json
{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000",
  "drug": "CLOPIDOGREL",
  "timestamp": "2026-02-20T10:00:00.000Z",
  "mode": "patient",
  "risk_assessment": {
    "level": "HIGH",
    "confidence_score": 0.93
  },
  "pharmacogenomic_profile": {
    "gene": "CYP2C19",
    "phenotype": "Poor Metabolizer",
    "detected_variant": "*2/*2",
    "total_variants_found": 12,
    "signature_hash": "a3f1bc..."
  },
  "clinical_recommendation": "Avoid clopidogrel. Consider alternative antiplatelet therapy.",
  "llm_generated_explanation": {
    "summary": "CYP2C19 *2/*2 results in a non-functional enzyme, preventing conversion of clopidogrel to its active metabolite..."
  },
  "explainability_tree": {
    "drug": "CLOPIDOGREL",
    "gene": "CYP2C19",
    "variant": "*2/*2",
    "phenotype": "Poor Metabolizer",
    "risk": "HIGH",
    "recommendation": "Avoid clopidogrel. Consider alternative antiplatelet therapy."
  },
  "genomic_signature_id": "a3f1bc...",
  "quality_metrics": {
    "vcf_quality": "PASS",
    "genotype_completeness": "High"
  },
  "cache_status": "MISS"
}
```

**Error Responses**

| Status | Body                                   | Cause                   |
| ------ | -------------------------------------- | ----------------------- |
| `400`  | `{ "error": "No VCF file provided." }` | Missing file field      |
| `400`  | `{ "error": "No Drug specified." }`    | Missing drug field      |
| `500`  | `{ "error": "Internal Server Error" }` | Unexpected server error |

---

## Usage Examples

### cURL

```bash
curl -X POST http://localhost:3080/api/analyze \
  -F "file=@/path/to/patient.vcf" \
  -F "drug=clopidogrel" \
  -F "mode=expert"
```

### JavaScript (Fetch)

```js
const form = new FormData();
form.append("file", vcfFile); // File object from <input type="file">
form.append("drug", "warfarin");
form.append("mode", "patient");

const res = await fetch("http://localhost:3080/api/analyze", {
  method: "POST",
  body: form,
});

const data = await res.json();
console.log(data.risk_assessment.level); // e.g. "HIGH"
console.log(data.llm_generated_explanation.summary);
```

### Python (requests)

```python
import requests

with open("patient.vcf", "rb") as vcf:
    response = requests.post(
        "http://localhost:3080/api/analyze",
        files={"file": ("patient.vcf", vcf, "text/plain")},
        data={"drug": "clopidogrel", "mode": "expert"},
    )

print(response.json()["clinical_recommendation"])
```

---

## Team

| Name             | Role                           | LinkedIn                                                     |
| ---------------- | ------------------------------ | ------------------------------------------------------------ |
| Chirag Choudhary | Full-Stack Lead                | [https://www.linkedin.com/in/chirag-choudhary-4156b2376/](#) |
| Priyanshu Tomar  | Bioinformatics / Data Engineer | [N/A](#)                                                     |
| Kunal Rana       | Frontend / UX                  | [N/A](#)                                                     |

---

> Built at **RIFT'26** · February 2026
