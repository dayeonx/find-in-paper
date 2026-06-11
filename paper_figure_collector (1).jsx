import { useState, useRef } from "react";

const ARXIV_SEARCH_URL = "https://export.arxiv.org/api/query";

const SYSTEM_PROMPT = `You are a scientific figure analysis expert. You will be given an image from a research paper.

Your job:
1. Determine if this figure is a GRAPH/CHART (line chart, bar chart, scatter plot, histogram, heatmap, etc.)
2. If it IS a graph, extract the data by digitizing it.

Respond ONLY in valid JSON with this exact structure:
{
  "is_graph": true or false,
  "graph_type": "line" | "bar" | "scatter" | "histogram" | "heatmap" | "other" | null,
  "confidence": 0.0 to 1.0,
  "title": "figure title if visible, or null",
  "x_axis": { "label": "...", "min": number_or_null, "max": number_or_null, "unit": "..." },
  "y_axis": { "label": "...", "min": number_or_null, "max": number_or_null, "unit": "..." },
  "series": [
    {
      "name": "series name or legend label",
      "color": "color description",
      "data_points": [{"x": number, "y": number}, ...]
    }
  ],
  "notes": "any important observations about the data or limitations of extraction"
}

If is_graph is false, set all other fields to null except confidence and notes.
Be precise with data point extraction. Estimate values carefully from axis scales.`;

function Badge({ type }) {
  const styles = {
    line:      { bg: "#E6F1FB", color: "#0C447C", label: "Line" },
    bar:       { bg: "#EAF3DE", color: "#27500A", label: "Bar" },
    scatter:   { bg: "#EEEDFE", color: "#3C3489", label: "Scatter" },
    histogram: { bg: "#FAEEDA", color: "#633806", label: "Histogram" },
    heatmap:   { bg: "#FAECE7", color: "#712B13", label: "Heatmap" },
    other:     { bg: "#F1EFE8", color: "#444441", label: "Other" },
  };
  const s = styles[type] || styles.other;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, display: "inline-block" }}>
      {s.label}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#1D9E75" : pct >= 50 ? "#BA7517" : "#E24B4A";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "var(--color-border-tertiary)", borderRadius: 99 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.4s" }} />
      </div>
      <span style={{ fontSize: 11, color: "var(--color-text-secondary)", minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function DataTable({ series, xAxis, yAxis }) {
  if (!series || series.length === 0) return null;
  const allPoints = series.flatMap(s => s.data_points.map(p => ({ ...p, series: s.name })));
  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
            <th style={{ textAlign: "left", padding: "4px 8px", color: "var(--color-text-secondary)", fontWeight: 500 }}>Series</th>
            <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--color-text-secondary)", fontWeight: 500 }}>{xAxis?.label || "X"}</th>
            <th style={{ textAlign: "right", padding: "4px 8px", color: "var(--color-text-secondary)", fontWeight: 500 }}>{yAxis?.label || "Y"}</th>
          </tr>
        </thead>
        <tbody>
          {allPoints.map((p, i) => (
            <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
              <td style={{ padding: "3px 8px", color: "var(--color-text-secondary)", fontSize: 11 }}>{p.series}</td>
              <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{p.x}</td>
              <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{p.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({ result, index }) {
  const [expanded, setExpanded] = useState(false);
  const { paper, figure, analysis, imageUrl } = result;

  return (
    <div style={{
      background: "var(--color-background-primary)",
      border: analysis.is_graph ? "1px solid #9FE1CB" : "0.5px solid var(--color-border-tertiary)",
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        {imageUrl && (
          <img src={imageUrl} alt="figure" style={{ width: 80, height: 60, objectFit: "contain", borderRadius: 6, background: "#f5f5f5", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            {analysis.is_graph
              ? <><Badge type={analysis.graph_type} /><span style={{ fontSize: 11, color: "#1D9E75", fontWeight: 500 }}>✓ 그래프 감지됨</span></>
              : <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>그래프 아님</span>
            }
          </div>
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {paper.title}
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>
            Figure {figure.index + 1} · {paper.authors}
          </div>
          {analysis.is_graph && (
            <ConfidenceBar value={analysis.confidence} />
          )}
        </div>
      </div>

      {analysis.is_graph && (
        <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", padding: "8px 16px" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
            {analysis.title && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>제목: <strong style={{ color: "var(--color-text-primary)" }}>{analysis.title}</strong></span>}
            {analysis.x_axis?.label && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>X: {analysis.x_axis.label} {analysis.x_axis.unit !== "unknown" ? `(${analysis.x_axis.unit})` : ""}</span>}
            {analysis.y_axis?.label && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>Y: {analysis.y_axis.label} {analysis.y_axis.unit !== "unknown" ? `(${analysis.y_axis.unit})` : ""}</span>}
          </div>

          <button
            onClick={() => setExpanded(v => !v)}
            style={{ fontSize: 11, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
          >
            <i className={`ti ti-chevron-${expanded ? "up" : "down"}`} style={{ fontSize: 13 }} />
            {expanded ? "데이터 숨기기" : `데이터 보기 (${analysis.series?.flatMap(s => s.data_points).length || 0}개 포인트)`}
          </button>

          {expanded && <DataTable series={analysis.series} xAxis={analysis.x_axis} yAxis={analysis.y_axis} />}

          {analysis.notes && (
            <p style={{ fontSize: 11, color: "var(--color-text-secondary)", marginTop: 8, fontStyle: "italic" }}>{analysis.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

async function fetchArxivPapers(query, maxResults = 5) {
  const url = `${ARXIV_SEARCH_URL}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
  const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
  const json = await res.json();
  const parser = new DOMParser();
  const xml = parser.parseFromString(json.contents, "text/xml");
  const entries = Array.from(xml.querySelectorAll("entry"));
  return entries.map(e => ({
    id: e.querySelector("id")?.textContent?.trim(),
    title: e.querySelector("title")?.textContent?.trim().replace(/\s+/g, " "),
    authors: Array.from(e.querySelectorAll("author name")).map(a => a.textContent).join(", "),
    pdfUrl: e.querySelector("link[title='pdf']")?.getAttribute("href") || e.querySelector("id")?.textContent?.replace("abs", "pdf").trim(),
    abstract: e.querySelector("summary")?.textContent?.trim(),
  }));
}

async function extractFiguresFromPdf(pdfUrl) {
  // PDF.js를 이용해 페이지를 이미지로 렌더링
  const pdfjsLib = window.pdfjsLib;
  if (!pdfjsLib) return [];

  const loadingTask = pdfjsLib.getDocument({
    url: `https://api.allorigins.win/get?url=${encodeURIComponent(pdfUrl)}`,
    isEvalSupported: false,
  });
  try {
    const pdf = await loadingTask.promise;
    const figures = [];
    const totalPages = Math.min(pdf.numPages, 8); // 최대 8페이지

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      figures.push({ index: pageNum - 1, dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
    }
    return figures;
  } catch {
    return [];
  }
}

async function analyzeFigureWithClaude(imageDataUrl) {
  const base64 = imageDataUrl.split(",")[1];
  const mediaType = imageDataUrl.startsWith("data:image/jpeg") ? "image/jpeg" : "image/png";

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Analyze this figure and extract data if it's a graph." }
        ]
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.map(c => c.text || "").join("") || "{}";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { is_graph: false, confidence: 0, notes: "분석 실패" };
  }
}

export default function App() {
  const [query, setQuery] = useState("");
  const [maxPapers, setMaxPapers] = useState(3);
  const [status, setStatus] = useState("idle"); // idle | searching | analyzing | done | error
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const abortRef = useRef(false);

  const addLog = (msg) => setLogs(l => [...l, msg]);

  const downloadCSV = () => {
    const graphResults = results.filter(r => r.analysis.is_graph);
    const rows = [["paper_title", "authors", "figure_index", "graph_type", "confidence", "title", "x_label", "x_unit", "y_label", "y_unit", "series_name", "x", "y"]];
    graphResults.forEach(r => {
      (r.analysis.series || []).forEach(s => {
        s.data_points.forEach(p => {
          rows.push([
            `"${r.paper.title}"`, `"${r.paper.authors}"`, r.figure.index + 1,
            r.analysis.graph_type, r.analysis.confidence,
            `"${r.analysis.title || ""}"`,
            r.analysis.x_axis?.label || "", r.analysis.x_axis?.unit || "",
            r.analysis.y_axis?.label || "", r.analysis.y_axis?.unit || "",
            `"${s.name}"`, p.x, p.y
          ]);
        });
      });
    });
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "figures.csv"; a.click();
  };

  const run = async () => {
    if (!query.trim()) return;
    abortRef.current = false;
    setStatus("searching");
    setLogs([]);
    setResults([]);
    setStats(null);

    try {
      addLog(`🔍 arXiv에서 "${query}" 검색 중...`);
      const papers = await fetchArxivPapers(query, maxPapers);
      addLog(`📄 ${papers.length}편의 논문 발견`);

      if (papers.length === 0) { setStatus("done"); addLog("검색 결과 없음"); return; }

      let totalFigures = 0, graphCount = 0;
      setStatus("analyzing");

      for (const paper of papers) {
        if (abortRef.current) break;
        addLog(`📑 "${paper.title.slice(0, 50)}..." 처리 중`);

        const pdfUrl = paper.pdfUrl;
        const figures = await extractFiguresFromPdf(pdfUrl);
        addLog(`  → ${figures.length}개 페이지/figure 추출됨`);
        totalFigures += figures.length;

        for (const figure of figures) {
          if (abortRef.current) break;
          addLog(`  → Figure ${figure.index + 1} 분석 중...`);
          const analysis = await analyzeFigureWithClaude(figure.dataUrl);
          if (analysis.is_graph) {
            graphCount++;
            addLog(`  ✅ 그래프 감지! (${analysis.graph_type}, ${Math.round(analysis.confidence * 100)}%)`);
          }
          setResults(prev => [...prev, { paper, figure, analysis, imageUrl: figure.dataUrl }]);
        }
      }

      setStats({ totalPapers: papers.length, totalFigures, graphCount });
      setStatus("done");
      addLog(`✅ 완료: ${graphCount}개 그래프 발견 (총 ${totalFigures}개 figure 중)`);
    } catch (e) {
      setStatus("error");
      addLog(`❌ 오류: ${e.message}`);
    }
  };

  const graphResults = results.filter(r => r.analysis.is_graph);

  return (
    <div style={{ padding: "1.5rem 1rem", maxWidth: 680, margin: "0 auto" }}>
      <h2 style={{ sr: "only" }}>논문 Figure 자동 수집 AI</h2>

      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && status !== "searching" && status !== "analyzing" && run()}
            placeholder="검색어 입력 (예: neural scaling laws, protein folding)"
            style={{ flex: 1 }}
            disabled={status === "searching" || status === "analyzing"}
          />
          <button
            onClick={status === "searching" || status === "analyzing" ? () => { abortRef.current = true; setStatus("done"); } : run}
            style={{ background: status === "searching" || status === "analyzing" ? "var(--color-background-danger)" : undefined, color: status === "searching" || status === "analyzing" ? "var(--color-text-danger)" : undefined }}
          >
            {status === "searching" || status === "analyzing" ? "중단" : "분석 시작 ↗"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>최대 논문 수:</label>
          <input type="range" min={1} max={10} step={1} value={maxPapers} onChange={e => setMaxPapers(Number(e.target.value))} style={{ width: 120 }} />
          <span style={{ fontSize: 13, fontWeight: 500, minWidth: 20 }}>{maxPapers}</span>
        </div>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: "1.5rem" }}>
          {[
            { label: "논문", value: stats.totalPapers },
            { label: "전체 figure", value: stats.totalFigures },
            { label: "그래프 발견", value: stats.graphCount },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--color-background-secondary)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 500 }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {graphResults.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>그래프 결과 ({graphResults.length}개)</span>
          <button onClick={downloadCSV} style={{ fontSize: 12 }}>
            <i className="ti ti-download" style={{ fontSize: 14, verticalAlign: -2, marginRight: 4 }} aria-hidden="true" />
            CSV 다운로드
          </button>
        </div>
      )}

      {results.map((r, i) => r.analysis.is_graph && <ResultCard key={i} result={r} index={i} />)}

      {logs.length > 0 && (
        <div style={{ marginTop: "1.5rem", background: "var(--color-background-secondary)", borderRadius: 8, padding: "12px 14px", maxHeight: 200, overflowY: "auto" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>로그</div>
          {logs.map((l, i) => (
            <div key={i} style={{ fontSize: 11, color: "var(--color-text-secondary)", fontFamily: "var(--font-mono)", lineHeight: 1.8 }}>{l}</div>
          ))}
        </div>
      )}

      {status === "idle" && (
        <div style={{ textAlign: "center", padding: "2rem 0", color: "var(--color-text-secondary)", fontSize: 13 }}>
          arXiv 논문에서 그래프를 찾아 데이터를 자동 추출합니다
        </div>
      )}
    </div>
  );
}
