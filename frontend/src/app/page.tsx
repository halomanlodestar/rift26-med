"use client";

import { useState, FormEvent, useRef } from "react";
import Image from "next/image";
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
  ChevronRight,
  Search,
  FlaskConical
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
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

// 1. Raw types matching actual backend response
interface RawAnalysisResult {
  patient_id: string;
  drug: string;
  timestamp: string;
  mode: 'patient' | 'expert';
  risk_assessment: {
    level: string;
    confidence_score: number;
  };
  pharmacogenomic_profile: {
    gene: string;
    phenotype: string;
    detected_variant: string;
    total_variants_found: number;
    signature_hash: string;
  };
  clinical_recommendation: string;
  llm_generated_explanation: {
    summary: string;
  };
  explainability_tree: {
    drug: string;
    gene: string;
    variant: string;
    phenotype: string;
    risk: string;
    recommendation: string;
  };
  genomic_signature_id: string;
  cache_status: 'HIT' | 'MISS';
  quality_metrics: {
    vcf_quality: string;
    genotype_completeness: string;
  };
}

// 2. Transformed types matching desired frontend usage
interface AnalysisResult {
  patient_id: string;
  drug: string;
  timestamp: string;
  risk_assessment: {
    risk_label: string;
    confidence_score: number;
    severity: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  };
  pharmacogenomic_profile: {
    primary_gene: string;
    diplotype: string;
    phenotype: string;
    detected_variants: Array<{
      rsid: string;
      variant: string;
    }>;
  };
  clinical_recommendation: {
    text: string;
  };
  llm_generated_explanation: {
    summary: string;
  };
  quality_metrics: {
    vcf_parsing_success: boolean;
    genotype_completeness: string;
  };
  // Keeping explainability_tree for UI visualization even if not in JSON spec
  explainability_tree: {
    drug: string;
    gene: string;
    variant: string;
    phenotype: string;
    risk: string;
    recommendation: string;
  };
  mode: 'patient' | 'expert'; // Keeping mode for UI logic
  cache_status: 'HIT' | 'MISS'; // Keeping cache for UI logic
  genomic_signature_id: string; // Keeping for UI signature
}

const DRUG_OPTIONS = [
  "CODEINE",
  "WARFARIN",
  "CLOPIDOGREL",
  "SIMVASTATIN",
  "AZATHIOPRINE",
  "FLUOROURACIL",
];

// --- Helpers ---

// Transform function
const transformAnalysisResult = (raw: RawAnalysisResult): AnalysisResult => {
  // Infer severity from level
  let severity: AnalysisResult['risk_assessment']['severity'] = 'moderate';
  const r = raw.risk_assessment.level.toLowerCase();
  if (r.includes('toxic') || r.includes('severe')) severity = 'critical';
  else if (r.includes('high') || r.includes('avoid')) severity = 'high';
  else if (r.includes('note') || r.includes('monitor')) severity = 'low';
  else if (r.includes('safe') || r.includes('normal')) severity = 'none';

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
      diplotype: raw.pharmacogenomic_profile.detected_variant, // Mapping detected_variant to diplotype as requested
      phenotype: raw.pharmacogenomic_profile.phenotype,
      detected_variants: [
        {
          rsid: "N/A", // Backend doesn't provide rsID yet
          variant: raw.pharmacogenomic_profile.detected_variant
        }
      ]
    },
    clinical_recommendation: {
      text: raw.clinical_recommendation
    },
    llm_generated_explanation: raw.llm_generated_explanation,
    quality_metrics: {
      vcf_parsing_success: raw.quality_metrics.vcf_quality === 'PASS',
      genotype_completeness: raw.quality_metrics.genotype_completeness
    },
    explainability_tree: raw.explainability_tree,
    cache_status: raw.cache_status,
    genomic_signature_id: raw.genomic_signature_id
  };
};


const getRiskColor = (risk: string) => {
  const r = risk.toLowerCase();
  if (r.includes("toxic") || r.includes("ineffective") || r.includes("high") || r.includes("avoid") || r.includes("severe")) {
    return "bg-destructive/10 border-destructive/20 text-destructive shadow-sm";
  }
  if (r.includes("caution") || r.includes("monitor") || r.includes("reduced") || r.includes("sensitivity")) {
    return "bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400 shadow-sm";
  }
  return "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-sm";
};

const getProgressBarColor = (risk: string) => {
  const r = risk.toLowerCase();
  if (r.includes("toxic") || r.includes("ineffective") || r.includes("high") || r.includes("avoid")) return "bg-destructive";
  if (r.includes("caution") || r.includes("monitor")) return "bg-yellow-500";
  return "bg-emerald-500";
};

// --- Components ---

export default function Home() {
  const [selectedDrug, setSelectedDrug] = useState<string>(DRUG_OPTIONS[0]);
  const [mode, setMode] = useState<'patient' | 'expert'>('patient');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a VCF file.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("drug", selectedDrug);
      formData.append("mode", mode);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed");
      }

      const rawData: RawAnalysisResult = await response.json();
      const transformedData = transformAnalysisResult(rawData);
      setResult(transformedData);
    } catch (err: unknown) {
      let errorMessage = "An unexpected error occurred.";
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "string") {
        errorMessage = err;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      alert("Copied to clipboard!");
    }
  };

  const downloadJson = () => {
    if (result) {
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pharmaguard_report_${result.patient_id.slice(0, 8)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/10 pb-20">
      <TooltipProvider>
        {/* 1. HEADER BAR */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between px-4 md:px-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-foreground">PharmaGuard</span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium hidden sm:inline-block">Pharmacogenomic Risk System</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium transition-colors ${mode === 'patient' ? 'text-primary' : 'text-muted-foreground'}`}>Patient</span>
                <Switch
                  checked={mode === 'expert'}
                  onCheckedChange={(checked) => setMode(checked ? 'expert' : 'patient')}
                  className="data-[state=checked]:bg-primary"
                />
                <span className={`text-xs font-medium transition-colors ${mode === 'expert' ? 'text-primary' : 'text-muted-foreground'}`}>Expert</span>
              </div>
            </div>
          </div>
        </header>

        <main className="container max-w-5xl mx-auto py-10 px-4 md:px-6 space-y-12">

          {/* 2. INPUT CARD */}
          <section className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="w-full max-w-2xl border-none shadow-sm rounded-xl bg-card/50 backdrop-blur-sm ring-1 ring-black/5 dark:ring-white/10">
              <CardHeader className="text-center pb-8 border-b border-border/50">
                <CardTitle className="text-2xl font-bold">New Analysis</CardTitle>
                <CardDescription>Select a medication and upload your VCF file to assess pharmacogenomic risk.</CardDescription>
              </CardHeader>
              <CardContent className="pt-8 space-y-6 p-6">
                {error && (
                  <Alert variant="destructive" className="animate-pulse">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Analysis Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Target Medication
                    </label>
                    <Select value={selectedDrug} onValueChange={setSelectedDrug}>
                      <SelectTrigger className="w-full h-12 text-base">
                        <SelectValue placeholder="Select a drug" />
                      </SelectTrigger>
                      <SelectContent>
                        {DRUG_OPTIONS.map((drug) => (
                          <SelectItem key={drug} value={drug} className="cursor-pointer">
                            {drug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[0.8rem] text-muted-foreground">
                      Choose the medication you intend to prescribe or check against.
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Genomic Data (VCF)
                    </label>
                    <div
                      role="button"
                      tabIndex={0}
                      className={`
                        relative flex flex-col items-center justify-center w-full h-40 rounded-xl border-2 border-dashed 
                        transition-all duration-200 outline-none
                        ${file
                          ? "border-primary/50 bg-primary/5"
                          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}
                      `}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".vcf,.txt"
                        className="hidden"
                        onChange={handleFileChange}
                      />

                      {file ? (
                        <div className="flex flex-col items-center gap-2 text-primary animate-in zoom-in-50 duration-300">
                          <CheckCircle2 className="w-10 h-10" />
                          <div className="text-center">
                            <p className="font-semibold text-sm">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB ready</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-8 h-8 opacity-50" />
                          <div className="text-center">
                            <p className="font-medium text-sm text-foreground">Click to upload or drag and drop</p>
                            <p className="text-xs">VCF or TXT files supported</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pb-8 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isLoading || !file}
                  className="w-full py-6 text-base font-semibold shadow-sm shadow-primary/20 transition-all hover:shadow-primary/30 rounded-lg"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Running Pharmacogenomic Analysis...
                    </>
                  ) : (
                    "Analyze Profile"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </section>

          {/* 3. RESULTS DASHBOARD */}
          {isLoading && !result && (
            <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
              <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-48 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
              <Skeleton className="h-96 rounded-xl" />
            </div>
          )}

          {result && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">

              {/* Row 1: Risk + Confidence */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">

                {/* Risk Card */}
                <Card className={`md:col-span-7 lg:col-span-8 border-l-8 overflow-hidden shadow-sm rounded-xl h-full ${getRiskColor(result.risk_assessment.risk_label)}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="bg-background/50 font-mono text-xs uppercase tracking-wider">
                        {result.timestamp.split("T")[0]}
                      </Badge>
                      {result.cache_status === 'HIT' && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-none">
                          ⚡ Instant Result
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-sm font-medium uppercase tracking-wider opacity-70">
                      Risk Assessment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    <div className="flex flex-col gap-1">
                      <span className="text-4xl md:text-5xl font-extrabold tracking-tight">
                        {result.risk_assessment.risk_label}
                      </span>
                      <span className="text-xl font-medium opacity-80 mt-1">
                        for {result.drug}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Confidence Card */}
                <Card className="md:col-span-5 lg:col-span-4 flex flex-col justify-center border-none bg-card shadow-sm rounded-xl ring-1 ring-border/50 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Confidence Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-end justify-between">
                      <span className="text-4xl font-bold tabular-nums">
                        {Math.round(result.risk_assessment.confidence_score * 100)}
                        <span className="text-lg text-muted-foreground ml-1">%</span>
                      </span>
                      <span className="text-xs font-medium text-muted-foreground mb-1.5">Based on variant evidence</span>
                    </div>
                    <Progress
                      value={result.risk_assessment.confidence_score * 100}
                      className="h-3 w-full"
                      indicatorClassName={getProgressBarColor(result.risk_assessment.risk_label)}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Clinical + Genomic */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <Card className="border-t-4 border-t-primary shadow-sm rounded-xl w-full h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Clinical Recommendation
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <p className="text-lg text-foreground leading-relaxed">
                      {result.clinical_recommendation.text}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-t-4 border-t-indigo-500 shadow-sm rounded-xl w-full h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Dna className="w-5 h-5 text-indigo-500" />
                      Genomic Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Target Gene</span>
                        <span className="font-mono font-medium">{result.pharmacogenomic_profile.primary_gene}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Phenotype</span>
                        <span className="font-medium text-right">{result.pharmacogenomic_profile.phenotype}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-sm text-muted-foreground">Detected Variant</span>
                        <Badge variant="secondary" className="font-mono">
                          {result.pharmacogenomic_profile.diplotype || "None"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-muted-foreground">Signature ID</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono text-xs text-muted-foreground truncat cursor-help border-b border-dotted max-w-[150px] truncate">
                              {result.genomic_signature_id}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-mono text-xs">{result.genomic_signature_id}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator className="my-2" />

              {/* Row 3: Detailed Tabs */}
              <Card className="shadow-sm border-none ring-1 ring-border/50 bg-card/50 rounded-xl w-full">
                <Tabs defaultValue="explanation" className="w-full">
                  <div className="border-b px-6 pt-4">
                    <TabsList className="flex flex-col h-96">
                      <TabsTrigger value="explanation">Explanation</TabsTrigger>
                      <TabsTrigger value="profile">Profile Details</TabsTrigger>
                      <TabsTrigger value="tree">Explainability</TabsTrigger>
                      <TabsTrigger value="json">Raw JSON</TabsTrigger>
                    </TabsList>
                  </div>

                  <div className="p-6 min-h-[300px]">
                    <TabsContent value="explanation" className="mt-0 focus-visible:outline-none">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            Analysis Summary
                          </h3>
                          <Badge variant={mode === 'expert' ? 'default' : 'secondary'}>
                            {mode === 'expert' ? 'Expert View' : 'Patient View'}
                          </Badge>
                        </div>
                        <Card className="shadow-none border bg-muted/20 mt-6">
                          <CardContent className="p-6 leading-relaxed text-sm text-slate-700 dark:text-slate-300">
                            <div className="space-y-4 whitespace-pre-line">
                              {result.llm_generated_explanation.summary}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </TabsContent>

                    <TabsContent value="profile" className="mt-0 focus-visible:outline-none">
                      <div className="rounded-md border overflow-hidden">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                            <tr>
                              <th className="px-4 py-3">Attribute</th>
                              <th className="px-4 py-3">Value</th>
                              <th className="px-4 py-3 hidden md:table-cell">Description</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            <tr>
                              <td className="px-4 py-3 font-medium">Gene</td>
                              <td className="px-4 py-3 font-mono text-primary">{result.pharmacogenomic_profile.primary_gene}</td>
                              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">Target biomarker for {result.drug}</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 font-medium">Phenotype</td>
                              <td className="px-4 py-3">{result.pharmacogenomic_profile.phenotype}</td>
                              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">Metabolizer status classification</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 font-medium">Detected Variant</td>
                              <td className="px-4 py-3 font-mono">{result.pharmacogenomic_profile.diplotype || "N/A"}</td>
                              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">Specific genetic marker identified</td>
                            </tr>
                            <tr>
                              <td className="px-4 py-3 font-medium">Quality Check</td>
                              <td className={`px-4 py-3 font-medium ${result.quality_metrics.vcf_parsing_success ? 'text-emerald-600' : 'text-red-600'}`}>
                                {result.quality_metrics.vcf_parsing_success ? 'PASS' : 'FAIL'}
                              </td>
                              <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">VCF integrity verified</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>

                    <TabsContent value="tree" className="mt-0 focus-visible:outline-none">
                      <div className="rounded-lg border bg-muted/30 p-8 overflow-x-auto">
                        <div className="flex flex-col gap-4 min-w-[300px]">

                          {/* Level 1: Drug */}
                          <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-md">
                              <FlaskConical className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Drug</span>
                              <span className="font-semibold">{result.explainability_tree.drug}</span>
                            </div>
                          </div>

                          <div className="ml-5 border-l-2 border-muted-foreground/20 h-6"></div>

                          {/* Level 2: Gene */}
                          <div className="flex items-center gap-3 ml-8 animate-in fade-in slide-in-from-left-8 duration-500 delay-200">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-md">
                              <Dna className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Gene</span>
                              <span className="font-semibold">{result.explainability_tree.gene}</span>
                            </div>
                          </div>

                          <div className="ml-[3.25rem] border-l-2 border-muted-foreground/20 h-6"></div>

                          {/* Level 3: Variant */}
                          <div className="flex items-center gap-3 ml-16 animate-in fade-in slide-in-from-left-12 duration-500 delay-300">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-md">
                              <SearchesIcon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Biomarker</span>
                              <span className="font-mono font-medium">{result.explainability_tree.variant}</span>
                            </div>
                          </div>

                          <div className="ml-[5.25rem] border-l-2 border-muted-foreground/20 h-6"></div>

                          {/* Level 4: Phenotype */}
                          <div className="flex items-center gap-3 ml-24 animate-in fade-in slide-in-from-left-16 duration-500 delay-500">
                            <div className="p-2 bg-pink-100 dark:bg-pink-900/30 text-pink-600 rounded-md">
                              <Fingerprint className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Phenotype</span>
                              <span className="font-medium bg-pink-50 dark:bg-pink-900/20 px-2 py-0.5 rounded text-pink-700 dark:text-pink-300">
                                {result.explainability_tree.phenotype}
                              </span>
                            </div>
                          </div>

                          <div className="ml-[7.25rem] border-l-2 border-muted-foreground/20 h-6"></div>

                          {/* Level 5: Risk */}
                          <div className="flex items-center gap-3 ml-32 animate-in fade-in slide-in-from-left-20 duration-500 delay-700">
                            <div className={`p-2 rounded-md ${result.risk_assessment.risk_label.toLowerCase().includes('high') || result.risk_assessment.risk_label.toLowerCase().includes('toxic') ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              <Activity className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-muted-foreground uppercase">Outcome</span>
                              <span className="font-bold">{result.explainability_tree.risk}</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="json" className="mt-0 focus-visible:outline-none">
                      <div className="relative rounded-lg border bg-muted/50 p-4 font-mono text-xs overflow-auto max-h-[400px]">
                        <pre className="whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
                      </div>
                      <div className="flex gap-4 mt-4">
                        <Button variant="outline" className="w-full" onClick={downloadJson}>
                          <Download className="w-4 h-4 mr-2" /> Download Report
                        </Button>
                        <Button variant="outline" className="w-full" onClick={copyToClipboard}>
                          <Copy className="w-4 h-4 mr-2" /> Copy to Clipboard
                        </Button>
                      </div>
                    </TabsContent>

                  </div>

                </Tabs>
              </Card>

            </div>
          )}
        </main>
      </TooltipProvider>
    </div>
  );
}

// Icon helper for the tree
function SearchesIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}
