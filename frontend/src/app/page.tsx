/** @format */

"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Activity,
  Dna,
  Fingerprint,
  Download,
  Copy,
  FlaskConical,
  ChevronRight,
  Zap,
  Beaker,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// --- Types ---
interface RawAnalysisResult {
  patient_id: string;
  drug: string;
  timestamp: string;
  mode: "patient" | "expert";
  risk_assessment: { level: string; confidence_score: number };
  pharmacogenomic_profile: {
    gene: string;
    phenotype: string;
    detected_variant: string;
    total_variants_found: number;
    signature_hash: string;
  };
  clinical_recommendation: string;
  llm_generated_explanation: { summary: string };
  explainability_tree: {
    drug: string;
    gene: string;
    variant: string;
    phenotype: string;
    risk: string;
    recommendation: string;
  };
  genomic_signature_id: string;
  cache_status: "HIT" | "MISS";
  quality_metrics: { vcf_quality: string; genotype_completeness: string };
}

interface AnalysisResult {
  patient_id: string;
  drug: string;
  timestamp: string;
  mode: "patient" | "expert";
  risk_assessment: {
    risk_label: string;
    confidence_score: number;
    severity: string;
  };
  pharmacogenomic_profile: {
    primary_gene: string;
    diplotype: string;
    phenotype: string;
    detected_variants: Array<{ rsid: string; variant: string }>;
  };
  clinical_recommendation: { text: string };
  llm_generated_explanation: { summary: string };
  quality_metrics: {
    vcf_parsing_success: boolean;
    genotype_completeness: string;
  };
  explainability_tree: {
    drug: string;
    gene: string;
    variant: string;
    phenotype: string;
    risk: string;
    recommendation: string;
  };
  cache_status: "HIT" | "MISS";
  genomic_signature_id: string;
}

type Theme = "clinical" | "premium-ai" | "enterprise";

const DRUG_OPTIONS = [
  "CODEINE",
  "WARFARIN",
  "CLOPIDOGREL",
  "SIMVASTATIN",
  "AZATHIOPRINE",
  "FLUOROURACIL",
];

const transformAnalysisResult = (raw: RawAnalysisResult): AnalysisResult => {
  let severity = "moderate";
  const r = raw.risk_assessment.level.toLowerCase();
  if (r.includes("toxic") || r.includes("severe")) severity = "critical";
  else if (r.includes("high") || r.includes("avoid")) severity = "high";
  else if (r.includes("note") || r.includes("monitor")) severity = "low";
  else if (r.includes("safe") || r.includes("normal")) severity = "none";
  return {
    patient_id: raw.patient_id,
    drug: raw.drug,
    timestamp: raw.timestamp,
    mode: raw.mode,
    risk_assessment: {
      risk_label: raw.risk_assessment.level,
      confidence_score: raw.risk_assessment.confidence_score,
      severity,
    },
    pharmacogenomic_profile: {
      primary_gene: raw.pharmacogenomic_profile.gene,
      diplotype: raw.pharmacogenomic_profile.detected_variant,
      phenotype: raw.pharmacogenomic_profile.phenotype,
      detected_variants: [
        { rsid: "N/A", variant: raw.pharmacogenomic_profile.detected_variant },
      ],
    },
    clinical_recommendation: { text: raw.clinical_recommendation },
    llm_generated_explanation: raw.llm_generated_explanation,
    quality_metrics: {
      vcf_parsing_success: raw.quality_metrics.vcf_quality === "PASS",
      genotype_completeness: raw.quality_metrics.genotype_completeness,
    },
    explainability_tree: raw.explainability_tree,
    cache_status: raw.cache_status,
    genomic_signature_id: raw.genomic_signature_id,
  };
};

const getRiskConfig = (risk: string) => {
  const r = risk.toLowerCase();
  if (
    r.includes("toxic") ||
    r.includes("ineffective") ||
    r.includes("high") ||
    r.includes("avoid") ||
    r.includes("severe")
  ) {
    return {
      bg: "bg-red-950/60 border-red-500/30",
      text: "text-red-300",
      badge: "bg-red-500/20 text-red-300 border-red-500/30",
      progress: "bg-red-500",
      glow: "shadow-red-900/40",
      label: "High Risk",
    };
  }
  if (
    r.includes("caution") ||
    r.includes("monitor") ||
    r.includes("reduced") ||
    r.includes("sensitivity") ||
    r.includes("adjust")
  ) {
    return {
      bg: "bg-amber-950/60 border-amber-500/30",
      text: "text-amber-300",
      badge: "bg-amber-500/20 text-amber-300 border-amber-500/30",
      progress: "bg-amber-500",
      glow: "shadow-amber-900/40",
      label: "Adjust Dose",
    };
  }
  return {
    bg: "bg-emerald-950/60 border-emerald-500/30",
    text: "text-emerald-300",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    progress: "bg-emerald-500",
    glow: "shadow-emerald-900/40",
    label: "Safe",
  };
};

// --- Explainability Chain ---
function ExplainabilityChain({
  tree,
  risk,
}: {
  tree: AnalysisResult["explainability_tree"];
  risk: string;
}) {
  const riskCfg = getRiskConfig(risk);
  const steps = [
    {
      icon: <FlaskConical className="w-5 h-5" />,
      label: "Drug",
      value: tree.drug,
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    {
      icon: <Dna className="w-5 h-5" />,
      label: "Gene",
      value: tree.gene,
      color: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    },
    {
      icon: <Beaker className="w-5 h-5" />,
      label: "Variant",
      value: tree.variant,
      color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
      mono: true,
    },
    {
      icon: <Fingerprint className="w-5 h-5" />,
      label: "Phenotype",
      value: tree.phenotype,
      color: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    },
    {
      icon: <Activity className="w-5 h-5" />,
      label: "Risk",
      value: tree.risk,
      color: riskCfg.badge,
    },
  ];

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-0 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div
          key={step.label}
          className="flex flex-row md:flex-row items-center gap-2 md:gap-0"
        >
          <div
            className={`flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-xl border backdrop-blur-sm min-w-30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg slide-in-bottom ${step.color}`}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="opacity-80">{step.icon}</div>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
              {step.label}
            </span>
            <span
              className={`text-sm font-semibold text-center leading-tight ${step.mono ? "font-mono text-xs" : ""}`}
            >
              {step.value}
            </span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 opacity-30 shrink-0 rotate-0 md:rotate-0 mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

// --- Skeleton Loader ---
function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <Skeleton className="md:col-span-7 h-44 rounded-xl bg-white/5" />
        <Skeleton className="md:col-span-5 h-44 rounded-xl bg-white/5" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-40 rounded-xl bg-white/5" />
        <Skeleton className="h-40 rounded-xl bg-white/5" />
      </div>
      <Skeleton className="h-72 rounded-xl bg-white/5" />
    </div>
  );
}

// --- Main Component ---
export default function Home() {
  const [selectedDrug, setSelectedDrug] = useState<string>(DRUG_OPTIONS[0]);
  const [mode, setMode] = useState<"patient" | "expert">("patient");
  const [theme, setTheme] = useState<Theme>("clinical");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressVal, setProgressVal] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Auto-apply purple theme in expert mode, revert to clinical in patient mode
  useEffect(() => {
    if (mode === "expert") {
      setTheme("premium-ai");
    } else {
      setTheme("clinical");
    }
  }, [mode]);

  // Animate progress on result
  useEffect(() => {
    if (result) {
      setProgressVal(0);
      const target = Math.round(result.risk_assessment.confidence_score * 100);
      const timer = setTimeout(() => setProgressVal(target), 100);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const runAnalysis = async (
    currentFile: File,
    currentDrug: string,
    currentMode: "patient" | "expert",
  ) => {
    setError(null);
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("drug", currentDrug);
      formData.append("mode", currentMode);
      formData.append("file", currentFile);
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }
      const rawData: RawAnalysisResult = await response.json();
      setResult(transformAnalysisResult(rawData));
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a VCF file.");
      return;
    }
    await runAnalysis(file, selectedDrug, mode);
  };

  useEffect(() => {
    if (file && result) runAnalysis(file, selectedDrug, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    }
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmaguard_${result.patient_id.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const riskCfg = result
    ? getRiskConfig(result.risk_assessment.risk_label)
    : null;
  const isExpert = mode === "expert";

  return (
    <TooltipProvider>
      <div
        className="min-h-screen bg-background text-foreground font-sans"
        data-theme={theme}
      >
        {/* HEADER */}
        <header
          className="sticky top-0 z-50 w-full border-b border-white/10 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(to right, rgba(var(--primary-rgb,99,102,241),0.08), transparent)",
          }}
        >
          <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/20 text-primary shadow-sm">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-bold tracking-tight leading-none">
                  PharmaGuard
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:block">
                  Pharmacogenomic AI
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {/* Mode Toggle */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <span
                  onClick={() => setMode("patient")}
                  className={`cursor-pointer text-xs font-medium transition-colors select-none ${mode === "patient" ? "text-primary" : "text-muted-foreground"}`}
                >
                  Patient
                </span>
                <button
                  role="switch"
                  aria-checked={isExpert}
                  onClick={() => setMode(isExpert ? "patient" : "expert")}
                  className={`relative inline-flex h-[18.4px] w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isExpert ? "bg-primary" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ${
                      isExpert
                        ? "translate-x-[calc(100%-2px)]"
                        : "translate-x-0"
                    }`}
                  />
                </button>
                <span
                  onClick={() => setMode("expert")}
                  className={`cursor-pointer text-xs font-medium transition-colors select-none ${mode === "expert" ? "text-primary" : "text-muted-foreground"}`}
                >
                  Expert
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 flex flex-col gap-10">
          {/* INPUT CARD */}
          <section className="flex justify-center slide-in-bottom">
            <Card
              className={`w-full max-w-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-sm rounded-xl transition-all ${isExpert ? "" : "py-2"}`}
            >
              <CardHeader
                className={`text-center border-b border-white/10 ${isExpert ? "pb-4 pt-5" : "pb-6 pt-8"}`}
              >
                <CardTitle
                  className={
                    isExpert ? "text-xl font-bold" : "text-2xl font-bold"
                  }
                >
                  {isExpert ? "Analysis Parameters" : "New Genomic Analysis"}
                </CardTitle>
                <CardDescription className={isExpert ? "text-xs" : "text-sm"}>
                  {isExpert
                    ? "Configure pharmacogenomic variant analysis with VCF input."
                    : "Upload your genetic data to understand how your body processes medication."}
                </CardDescription>
              </CardHeader>
              <CardContent
                className={`${isExpert ? "p-4 space-y-4" : "p-6 space-y-6"}`}
              >
                {error && (
                  <Alert
                    variant="destructive"
                    className="bg-red-950/50 border-red-500/30 text-red-300"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription className="text-sm">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Drug Select */}
                <div className="space-y-2">
                  <label
                    className={`font-medium ${isExpert ? "text-xs text-muted-foreground uppercase tracking-wider" : "text-sm"}`}
                  >
                    {isExpert ? "Target Drug" : "Select Medication"}
                  </label>
                  <Select value={selectedDrug} onValueChange={setSelectedDrug}>
                    <SelectTrigger
                      className={`bg-white/5 border-white/10 ${isExpert ? "h-9 text-sm font-mono" : "h-12 text-base"}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background/95 backdrop-blur-md border-white/10">
                      {DRUG_OPTIONS.map((drug) => (
                        <SelectItem
                          key={drug}
                          value={drug}
                          className={`cursor-pointer ${isExpert ? "font-mono text-sm" : ""}`}
                        >
                          {drug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* VCF Upload */}
                <div className="space-y-2">
                  <label
                    className={`font-medium ${isExpert ? "text-xs text-muted-foreground uppercase tracking-wider" : "text-sm"}`}
                  >
                    {isExpert ? "VCF Input File" : "Genomic Data (VCF)"}
                  </label>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        fileInputRef.current?.click();
                    }}
                    className={`relative flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer outline-none
                      ${isExpert ? "h-28" : "h-40"}
                      ${file ? "border-primary/50 bg-primary/5" : "border-white/15 hover:border-primary/40 hover:bg-white/5"}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".vcf,.txt"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    {file ? (
                      <div className="flex flex-col items-center gap-2 text-primary">
                        <CheckCircle2 className="w-8 h-8" />
                        <div className="text-center">
                          <p
                            className={`font-semibold ${isExpert ? "text-xs font-mono" : "text-sm"}`}
                          >
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload
                          className={
                            isExpert
                              ? "w-6 h-6 opacity-40"
                              : "w-8 h-8 opacity-50"
                          }
                        />
                        <div className="text-center">
                          <p
                            className={`font-medium text-foreground ${isExpert ? "text-xs" : "text-sm"}`}
                          >
                            Click to upload VCF
                          </p>
                          <p className="text-xs text-muted-foreground">
                            .vcf or .txt
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Analyze Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !file}
                  className={`w-full font-semibold transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg
                    ${isExpert ? "h-9 text-sm" : "h-12 text-base"}`}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Analyzing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      {isExpert ? "Run Analysis" : "Analyze My Profile"}
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </section>

          {/* SKELETON */}
          {isLoading && !result && <SkeletonDashboard />}

          {/* RESULTS */}
          {result && (
            <div
              className={`flex flex-col gap-6 slide-in-bottom transition-opacity duration-300 ${isLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}
            >
              {/* ROW 1: Risk + Confidence */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                {/* Risk Card */}
                <Card
                  className={`md:col-span-7 border rounded-xl shadow-lg overflow-hidden backdrop-blur-md ${riskCfg!.bg} ${riskCfg!.glow}`}
                >
                  <CardHeader className="pb-2 pt-5 px-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge
                        className={`text-xs font-mono border ${riskCfg!.badge}`}
                      >
                        {result.timestamp.split("T")[0]}
                      </Badge>
                      <div className="flex items-center gap-2">
                        {result.cache_status === "HIT" && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs gap-1">
                            <Zap className="w-3 h-3" /> Cached
                          </Badge>
                        )}
                        <Badge className={`text-xs border ${riskCfg!.badge}`}>
                          {riskCfg!.label}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs uppercase tracking-widest opacity-50 font-bold">
                      Risk Assessment
                    </p>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <div
                      className={`font-extrabold tracking-tight leading-none ${riskCfg!.text} ${isExpert ? "text-4xl" : "text-5xl md:text-6xl"}`}
                    >
                      {result.risk_assessment.risk_label}
                    </div>
                    <div
                      className={`mt-2 opacity-80 font-medium ${isExpert ? "text-base" : "text-xl"}`}
                    >
                      for <span className="font-mono">{result.drug}</span>
                    </div>
                    {isExpert && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          Patient:
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {result.patient_id.slice(0, 12)}...
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Confidence Card */}
                <Card className="md:col-span-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-sm flex flex-col justify-center">
                  <CardHeader className="pb-2 pt-5 px-6">
                    <p className="text-xs uppercase tracking-widest opacity-50 font-bold">
                      Confidence Score
                    </p>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 space-y-4">
                    <div className="flex items-end justify-between">
                      <span
                        className={`font-bold tabular-nums ${isExpert ? "text-4xl" : "text-5xl"}`}
                      >
                        {progressVal}
                        <span className="text-lg text-muted-foreground ml-1">
                          %
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground mb-1.5">
                        variant evidence
                      </span>
                    </div>
                    <Progress
                      value={progressVal}
                      className="h-3 bg-white/10 transition-all duration-700"
                      indicatorClassName={`${riskCfg!.progress} transition-all duration-700`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Low</span>
                      <span>High</span>
                    </div>

                    {/* Genomic Signature */}
                    <Separator className="bg-white/10" />
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-widest opacity-50 font-bold">
                        Genomic Signature
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="font-mono text-xs text-muted-foreground truncate cursor-help border-b border-dashed border-white/20 pb-0.5">
                            {result.genomic_signature_id}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="bg-background/95 border-white/10 font-mono text-xs max-w-xs">
                          {result.genomic_signature_id}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ROW 2: Clinical + Genomic */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                {/* Clinical Recommendation */}
                <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-sm">
                  <CardHeader className="pb-3 pt-5 px-6 border-b border-white/10">
                    <CardTitle
                      className={`flex items-center gap-2 text-primary ${isExpert ? "text-sm" : "text-base"}`}
                    >
                      <FileText className="w-4 h-4" />
                      Clinical Recommendation
                    </CardTitle>
                  </CardHeader>
                  <CardContent
                    className={`px-6 py-5 ${isExpert ? "text-sm" : "text-base"} leading-relaxed`}
                  >
                    {result.clinical_recommendation.text}
                  </CardContent>
                </Card>

                {/* Genomic Profile */}
                <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-sm">
                  <CardHeader className="pb-3 pt-5 px-6 border-b border-white/10">
                    <CardTitle
                      className={`flex items-center gap-2 text-indigo-400 ${isExpert ? "text-sm" : "text-base"}`}
                    >
                      <Dna className="w-4 h-4" />
                      Genomic Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 py-4">
                    <div
                      className={`space-y-2 ${isExpert ? "text-xs" : "text-sm"}`}
                    >
                      {[
                        {
                          label: "Target Gene",
                          value: result.pharmacogenomic_profile.primary_gene,
                          mono: true,
                          tooltip:
                            "Pharmacogene responsible for drug metabolism",
                        },
                        {
                          label: "Phenotype",
                          value: result.pharmacogenomic_profile.phenotype,
                        },
                        {
                          label: "Detected Variant",
                          value:
                            result.pharmacogenomic_profile.diplotype || "None",
                          mono: true,
                          badge: true,
                        },
                        {
                          label: "VCF Quality",
                          value: result.quality_metrics.vcf_parsing_success
                            ? "PASS"
                            : "FAIL",
                          pass: result.quality_metrics.vcf_parsing_success,
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0"
                        >
                          <span className="text-muted-foreground">
                            {row.label}
                          </span>
                          {row.badge ? (
                            <Badge
                              variant="secondary"
                              className="font-mono text-xs bg-white/10 border-white/10"
                            >
                              {row.value}
                            </Badge>
                          ) : row.tooltip ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <span
                                  className={`font-semibold ${row.mono ? "font-mono text-primary cursor-help border-b border-dashed border-white/20" : ""}`}
                                >
                                  {row.value}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="bg-background/95 border-white/10 text-xs">
                                {row.tooltip}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span
                              className={`font-semibold ${row.mono ? "font-mono" : ""} ${row.pass === true ? "text-emerald-400" : row.pass === false ? "text-red-400" : ""}`}
                            >
                              {row.value}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ROW 3: Tabs */}
              <Card className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl shadow-sm">
                <Tabs defaultValue="explanation" className="w-full">
                  <div className="border-b border-white/10 px-4 pt-3">
                    <TabsList className="bg-transparent gap-1 h-28 flex-wrap">
                      {[
                        { value: "explanation", label: "Explanation" },
                        { value: "profile", label: "Profile Details" },
                        { value: "chain", label: "Explainability Chain" },
                        { value: "json", label: "Raw JSON" },
                      ].map((tab) => (
                        <TabsTrigger
                          key={tab.value}
                          value={tab.value}
                          className={`rounded-lg border h-full border-transparent data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:border-primary/30 text-muted-foreground transition-all ${isExpert ? "text-xs py-1.5 px-3" : "text-sm py-2 px-4"}`}
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>

                  {/* Explanation */}
                  <TabsContent
                    value="explanation"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <CardContent className="p-6 space-y-4 leading-relaxed">
                      <div className="flex items-center justify-between">
                        <h3
                          className={`font-semibold ${isExpert ? "text-sm" : "text-lg"}`}
                        >
                          LLM Analysis Summary
                        </h3>
                        <Badge
                          className={`text-xs ${isExpert ? "bg-primary/20 text-primary border-primary/30" : "bg-white/10 text-muted-foreground border-white/10"}`}
                        >
                          {isExpert ? "Expert Mode" : "Patient Mode"}
                        </Badge>
                      </div>
                      <div
                        className={`rounded-xl border border-white/10 bg-white/3 p-5 whitespace-pre-line ${isExpert ? "text-xs text-muted-foreground font-mono leading-relaxed" : "text-sm leading-loose"}`}
                      >
                        {result.llm_generated_explanation.summary}
                      </div>
                    </CardContent>
                  </TabsContent>

                  {/* Profile Details */}
                  <TabsContent
                    value="profile"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <CardContent className="p-6 space-y-4 leading-relaxed">
                      <div className="rounded-xl border border-white/10 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-white/5 text-muted-foreground text-xs uppercase tracking-wider border-b border-white/10">
                            <tr>
                              <th className="px-4 py-3 text-left">Attribute</th>
                              <th className="px-4 py-3 text-left">Value</th>
                              <th className="px-4 py-3 text-left hidden md:table-cell">
                                Notes
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {[
                              {
                                attr: "Gene",
                                val: result.pharmacogenomic_profile
                                  .primary_gene,
                                note: `Primary biomarker for ${result.drug}`,
                                mono: true,
                              },
                              {
                                attr: "Phenotype",
                                val: result.pharmacogenomic_profile.phenotype,
                                note: "Metabolizer classification",
                              },
                              {
                                attr: "Variant",
                                val:
                                  result.pharmacogenomic_profile.diplotype ||
                                  "N/A",
                                note: "Detected allele",
                                mono: true,
                              },
                              {
                                attr: "Completeness",
                                val: result.quality_metrics
                                  .genotype_completeness,
                                note: "Genotype coverage",
                              },
                              {
                                attr: "VCF Quality",
                                val: result.quality_metrics.vcf_parsing_success
                                  ? "PASS"
                                  : "FAIL",
                                note: "File integrity",
                                pass: result.quality_metrics
                                  .vcf_parsing_success,
                              },
                            ].map((row) => (
                              <tr
                                key={row.attr}
                                className="hover:bg-white/3 transition-colors"
                              >
                                <td
                                  className={`px-4 py-3 font-medium ${isExpert ? "text-xs" : "text-sm"}`}
                                >
                                  {row.attr}
                                </td>
                                <td
                                  className={`px-4 py-3 ${row.mono ? "font-mono text-primary" : ""} ${row.pass === true ? "text-emerald-400" : row.pass === false ? "text-red-400" : ""} ${isExpert ? "text-xs" : "text-sm"}`}
                                >
                                  {row.val}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                                  {row.note}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </TabsContent>

                  {/* Explainability Chain */}
                  <TabsContent
                    value="chain"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <CardContent className="p-6 space-y-4 leading-relaxed">
                      <div className="flex items-center justify-between mb-4">
                        <h3
                          className={`font-semibold ${isExpert ? "text-sm" : "text-base"}`}
                        >
                          Decision Chain
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          Causal pathway from drug → risk
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <ExplainabilityChain
                          tree={result.explainability_tree}
                          risk={result.risk_assessment.risk_label}
                        />
                      </div>
                      {isExpert && (
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/3 p-4">
                          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                            Recommendation
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {result.explainability_tree.recommendation}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </TabsContent>

                  {/* Raw JSON */}
                  <TabsContent
                    value="json"
                    className="mt-0 focus-visible:outline-none"
                  >
                    <CardContent className="p-6 space-y-4 leading-relaxed">
                      <div className="flex gap-3 mb-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white/5 border-white/10 hover:bg-white/10 gap-2 hover:scale-[1.02] transition-transform"
                          onClick={downloadJson}
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-white/5 border-white/10 hover:bg-white/10 gap-2 hover:scale-[1.02] transition-transform"
                          onClick={copyToClipboard}
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </Button>
                      </div>
                      <div className="relative rounded-xl border border-white/10 bg-black/30 p-4 max-h-96 overflow-auto">
                        <pre className="font-mono text-xs text-emerald-300/80 whitespace-pre-wrap wrap-break-word leading-relaxed">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </TabsContent>
                </Tabs>
              </Card>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-16 border-t border-white/10 py-6 text-center text-xs text-muted-foreground">
          PharmaGuard · RIFT 2026 · Pharmacogenomic Risk Prediction
        </footer>
      </div>
    </TooltipProvider>
  );
}
