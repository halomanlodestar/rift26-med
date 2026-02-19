"use client";

import { useState, FormEvent, useRef } from "react";

// --- Types ---

interface AnalysisResult {
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

const DRUG_OPTIONS = [
  "CODEINE",
  "WARFARIN",
  "CLOPIDOGREL",
  "SIMVASTATIN",
  "AZATHIOPRINE",
  "FLUOROURACIL",
];

// --- Helpers ---

const getRiskColor = (risk: string) => {
  const r = risk.toLowerCase();
  if (r.includes("toxic") || r.includes("ineffective") || r.includes("high") || r.includes("avoid") || r.includes("severe")) {
    return "bg-red-50 border-red-200 text-red-800";
  }
  if (r.includes("caution") || r.includes("monitor") || r.includes("reduced") || r.includes("sensitivity")) {
    return "bg-yellow-50 border-yellow-200 text-yellow-800";
  }
  return "bg-green-50 border-green-200 text-green-800";
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

      const data: AnalysisResult = await response.json();
      setResult(data);
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 text-gray-900 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-blue-900 tracking-tight sm:text-5xl">
            PharmaGuard
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Pharmacogenomic Risk Prediction System
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden mb-8">
          <div className="p-8">
            <h2 className="text-xl font-semibold mb-6 text-gray-800">
              Run Analysis
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Mode Toggle */}
              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                  <button
                    type="button"
                    onClick={() => setMode('patient')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'patient'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Patient Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('expert')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'expert'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    Expert Mode
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Drug
                </label>
                <select
                  value={selectedDrug}
                  onChange={(e) => setSelectedDrug(e.target.value)}
                  className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-gray-50 border"
                >
                  {DRUG_OPTIONS.map((drug) => (
                    <option key={drug} value={drug}>
                      {drug}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload VCF File
                </label>
                <div
                  className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600 justify-center">
                      <span className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                        <span>Upload a file</span>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept=".vcf,.txt"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                        />
                      </span>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      VCF or Text up to 50MB
                    </p>
                    {file && (
                      <p className="text-sm text-green-600 font-semibold mt-2">
                        Selected: {file.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all ${isLoading ? "opacity-75 cursor-not-allowed" : ""
                  }`}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Analyzing Genomic Data...
                  </span>
                ) : (
                  "Analyze Pharmacogenomic Profile"
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 text-red-700 bg-red-100 rounded-lg">
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-6 animate-fade-in-up">

            {/* Header with Signature ID & Cache Status */}
            <div className="flex justify-between items-center text-sm text-gray-500 px-2">
              <span>Genomic Signature: <span className="font-mono text-gray-700">{result.genomic_signature_id.substring(0, 16)}...</span></span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${result.cache_status === 'HIT' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                Cache: {result.cache_status}
              </span>
            </div>

            {/* Risk Assessment Card */}
            <div
              className={`rounded-xl border-l-8 p-6 shadow-md bg-white ${getRiskColor(
                result.risk_assessment.level
              )}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium opacity-80 uppercase tracking-widest">
                    Risk Assessment
                  </h3>
                  <p className="mt-2 text-3xl font-bold">
                    {result.risk_assessment.level}
                  </p>
                  <p className="mt-1 text-lg font-medium opacity-90">
                    {result.drug}
                  </p>
                  <div className="mt-3 flex items-center">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 w-32 mr-2">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${result.risk_assessment.confidence_score * 100}%` }}></div>
                    </div>
                    <span className="text-sm opacity-75">
                      {Math.round(result.risk_assessment.confidence_score * 100)}% Confidence
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-white/50">
                    {result.timestamp.split("T")[0]}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Explanation */}
            <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
              <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-white border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-purple-900 flex items-center">
                  <span className="mr-2">✨</span> Genomic Explanation
                </h3>
                <span className="text-xs font-medium text-purple-600 bg-purple-100 px-2 py-1 rounded uppercase">
                  {result.mode} Mode
                </span>
              </div>
              <div className="p-6">
                <p className="text-gray-700 leading-relaxed text-base whitespace-pre-line">
                  {result.llm_generated_explanation.summary}
                </p>
              </div>
            </div>

            {/* Explainability Tree */}
            <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
              <h3 className="text-gray-900 font-semibold mb-4 border-b pb-2">
                Explainability Tree
              </h3>
              <div className="font-mono text-sm bg-gray-50 p-4 rounded-lg overflow-x-auto">
                <ul className="list-none space-y-2">
                  <li><span className="text-blue-600 font-bold">DRUG:</span> {result.explainability_tree.drug}</li>
                  <li className="pl-4 border-l-2 border-gray-300 ml-1">
                    <span className="text-purple-600 font-bold">└── GENE:</span> {result.explainability_tree.gene}
                  </li>
                  <li className="pl-8 border-l-2 border-gray-300 ml-1">
                    <span className="text-indigo-600 font-bold">└── VARIANT:</span> {result.explainability_tree.variant}
                  </li>
                  <li className="pl-12 border-l-2 border-gray-300 ml-1">
                    <span className="text-pink-600 font-bold">└── PHENOTYPE:</span> {result.explainability_tree.phenotype}
                  </li>
                  <li className="pl-16 border-l-2 border-gray-300 ml-1">
                    <span className="text-red-600 font-bold">└── RISK:</span> {result.explainability_tree.risk}
                  </li>
                </ul>
              </div>
            </div>

            {/* Clinical Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
                <h3 className="text-gray-900 font-semibold mb-4 border-b pb-2">
                  Clinical Recommendation
                </h3>
                <p className="text-gray-600">
                  {result.clinical_recommendation}
                </p>
              </div>

              <div className="bg-white shadow-md rounded-xl p-6 border border-gray-100">
                <h3 className="text-gray-900 font-semibold mb-4 border-b pb-2">
                  Genomic Profile
                </h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Gene</dt>
                    <dd className="font-medium text-gray-900">
                      {result.pharmacogenomic_profile.gene}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Phenotype</dt>
                    <dd className="font-medium text-gray-900">
                      {result.pharmacogenomic_profile.phenotype}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Variants Found</dt>
                    <dd className="font-medium text-gray-900">
                      {result.pharmacogenomic_profile.total_variants_found}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Detected</dt>
                    <dd className="font-medium text-gray-900">
                      {result.pharmacogenomic_profile.detected_variant || "None"}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                onClick={downloadJson}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Download JSON report
              </button>
              <button
                onClick={copyToClipboard}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                Copy JSON
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
