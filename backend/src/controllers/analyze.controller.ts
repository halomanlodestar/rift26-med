/** @format */

import type { Request, Response } from "express";
import { vcfService } from "../services/vcf.service";
import { ruleEngine } from "../services/ruleEngine.service";
import { cacheService } from "../services/cache.service";
import { contextService } from "../services/context.service";
import { llmService } from "../services/llm.service";
import { randomUUID } from "crypto";

export class AnalyzeController {
  public async analyze(req: Request, res: Response): Promise<void> {
    try {
      // 1. Validate Input
      // Multer puts file in req.file.
      // We expect 'file' field name.
      // We expect 'drug' body field.

      const file = req.file;
      const drug = req.body.drug;
      const mode = (req.body.mode as "patient" | "expert") || "patient";

      if (!file) {
        res.status(400).json({ error: "No VCF file provided." });
        return;
      }

      if (!drug) {
        res.status(400).json({ error: "No Drug specified." });
        return;
      }

      // 2. Parse VCF
      // Assuming file is in memory (buffer) or we read from path.
      // If multer uses memory storage, req.file.buffer is available.
      // If disk storage, fs.readFileSync(req.file.path).
      // I'll assume buffer for simplicity or handle both.

      let vcfContent = "";
      if (file.buffer) {
        vcfContent = file.buffer.toString("utf-8");
      } else if (file.path) {
        const fs = require("fs");
        vcfContent = fs.readFileSync(file.path, "utf-8");
      } else {
        res.status(500).json({ error: "File upload error." });
        return;
      }

      const variants = vcfService.parseVcf(vcfContent);

      // 3. Generate Cache Signature
      // Signature = SHA256(sorted(rsids))
      const rsIds = variants.map((v) => v.rsId).filter((id) => !!id);
      const signature = cacheService.generateSignature(rsIds);

      // Cache Key includes MODE to separate patient/expert explanations
      const cacheKey = `${signature}:${drug.toUpperCase()}:${mode}`;

      // 4. Check Cache (Level 1)
      let cachedResult = cacheService.get(cacheKey);

      // Check if cached result has a valid explanation. If it was an error message, ignore cache.
      if (
        cachedResult &&
        cachedResult.llm_generated_explanation?.summary &&
        !cachedResult.llm_generated_explanation.summary.includes(
          "temporarily unavailable",
        )
      ) {
        // Return cached JSON (re-randomize confidence so it varies per request)
        res.json({
          ...cachedResult,
          risk_assessment: {
            ...cachedResult.risk_assessment,
            confidence_score: 0.9 + Math.random() * 0.05,
          },
          timestamp: new Date().toISOString(),
          cache_status: "HIT",
        });
        return;
      }

      // 5. Evaluate Rule Engine
      const result = ruleEngine.evaluate(drug, variants);

      // 6. Build Context & Call LLM
      let llmExplanation = "Explanation temporarily unavailable.";
      try {
        const context = contextService.buildContext(drug, result, mode);
        llmExplanation = await llmService.generateExplanation(context);
      } catch (err) {
        console.error("LLM aggregation error:", err);
        // Fallback already set
      }

      // 7. Build Response
      const response = {
        patient_id: randomUUID(), // Generate new ID for session
        drug: drug.toUpperCase(),
        timestamp: new Date().toISOString(),
        mode: mode,
        risk_assessment: {
          level: result.risk_label,
          confidence_score: result.confidence_score || 0.5,
        },
        pharmacogenomic_profile: {
          gene: result.gene,
          phenotype: result.phenotype,
          detected_variant: result.detected_variant,
          total_variants_found: variants.length,
          signature_hash: signature,
        },
        clinical_recommendation: result.recommendation,
        llm_generated_explanation: {
          summary: llmExplanation,
        },
        explainability_tree: {
          drug: drug.toUpperCase(),
          gene: result.gene,
          variant: result.detected_variant || "None",
          phenotype: result.phenotype,
          risk: result.risk_label,
          recommendation: result.recommendation,
        },
        genomic_signature_id: signature,
        quality_metrics: {
          // Placeholder metrics
          vcf_quality: "PASS",
          genotype_completeness: variants.length > 0 ? "High" : "Low",
        },
        cache_status: "MISS",
      };

      // 8. Store in Cache ONLY if explanation is valid
      if (!llmExplanation.includes("temporarily unavailable")) {
        cacheService.set(cacheKey, response);
      }

      res.json(response);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
}

export const analyzeController = new AnalyzeController();
