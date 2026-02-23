/**
 * insightsdashboard.jsx — "Am I improving?" Performance Insights
 *
 * 6 panels:
 *   1. Adaptive Engine Status  — semicircle gauge, trend, thresholds
 *   2. Personal Bests          — per-difficulty table
 *   3. Score Trend + Rolling Avg — SVG bars + 7-session rolling avg line
 *   4. Difficulty Progression  — SVG step chart
 *   5. Speed vs Score Scatter  — SVG scatter plot
 *   6. Attempts Efficiency     — stacked bars per difficulty
 *
 * All charts: pure SVG. All data from insightsengine.js (Dexie only).
 * Refreshed via refreshKey prop.
 */

import { useEffect, useState, useCallback } from "react";
import { computeInsightsData } from "../utils/insightsengine";
import { BS, font, radius, shadow } from "../constants/Brand";

/* ─── Design tokens ──────────────────────────────────────────────────────── */
const DC = {
  easy:   { hex: "#34d399", bg: "#ECFDF5", color: "#065F46" },
  medium: { hex: "#fbbf24", bg: "#FFFBEB", color: "#78350F" },
  hard:   { hex: "#f87171", bg: "#FEF2F2", color: "#7F1D1D" },
};

const TC = {
  improving: { color: "#059669", icon: "↑", bg: "#ECFDF5", border: "#6EE7B7" },
  stable:    { color: BS.textMuted, icon: "→", bg: BS.surface, border: BS.border },
  declining: { color: "#DC2626", icon: "↓", bg: "#FEF2F2", border: "#FCA5A5" },
};

/* ─── Shared primitives ──────────────────────────────────────────────────── */
function Panel({ children }) {
  return (
    <div style={{
      background: BS.card, border: `1px solid ${BS.border}`,
      borderRadius: radius.xl, boxShadow: shadow.card,
      padding: "20px 20px 24px", fontFamily: font.base,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <h3 style={{
        fontSize: "11px", fontWeight: 700, color: BS.textMuted,
        textTransform: "uppercase", letterSpacing: "0.08em",
        margin: 0, fontFamily: font.base,
      }}>
        {children}
      </h3>
      <div style={{
        height: "2px", width: "24px",
        background: `linear-gradient(90deg, ${BS.primary}, ${BS.violet})`,
        borderRadius: "1px", marginTop: "5px",
      }} />
      {sub && <p style={{ fontSize: "10px", color: BS.textSubtle, margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );
}

function Empty({ msg }) {
  return (
    <p style={{ textAlign: "center", color: BS.textSubtle, fontSize: "12px", padding: "24px 0", fontStyle: "italic" }}>
      {msg}
    </p>
  );
}

function DiffBadge({ diff }) {
  const d = DC[diff] ?? DC.easy;
  return (
    <span style={{
      background: d.bg, color: d.color,
      borderRadius: radius.full, padding: "2px 9px",
      fontSize: "10px", fontWeight: 700,
      textTransform: "capitalize",
    }}>
      {diff}
    </span>
  );
}

/* ─── Panel 1: Adaptive Status Gauge ────────────────────────────────────── */
function AdaptiveStatusPanel({ summary }) {
  if (!summary) return (
    <Panel>
      <SectionTitle>Adaptive Engine Status</SectionTitle>
      <Empty msg="Solve at least 7 puzzles to see adaptive engine status." />
    </Panel>
  );

  const { currentDifficulty, trend, performanceScore, ptsToAdvance, ptsAtRisk } = summary;
  const tc = TC[trend] ?? TC.stable;
  const dc = DC[currentDifficulty] ?? DC.easy;
  const gaugeColor = performanceScore >= 75 ? "#34d399" : performanceScore >= 35 ? "#fbbf24" : "#f87171";

  // Semicircle gauge math
  const R = 44, CX = 60, CY = 60;
  const half = Math.PI * R;
  const filled = (performanceScore / 100) * half;

  return (
    <Panel>
      <SectionTitle children="Adaptive Engine Status" sub="Based on your last 7 sessions" />

      <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
        {/* Gauge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <svg width="120" height="72" viewBox="0 0 120 72" style={{ overflow: "visible" }}>
            <path
              d={`M ${CX-R} ${CY} A ${R} ${R} 0 0 1 ${CX+R} ${CY}`}
              fill="none" stroke={BS.border} strokeWidth="10" strokeLinecap="round"
            />
            <path
              d={`M ${CX-R} ${CY} A ${R} ${R} 0 0 1 ${CX+R} ${CY}`}
              fill="none" stroke={gaugeColor} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${filled} ${half}`}
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
            <text x={CX} y={CY - 4} textAnchor="middle" fontSize="18" fontWeight="800" fill={BS.text}>
              {performanceScore}
            </text>
            <text x={CX} y={CY + 12} textAnchor="middle" fontSize="9" fill={BS.textSubtle}>
              / 100
            </text>
          </svg>
          <span style={{ fontSize: "10px", color: BS.textSubtle, marginTop: "-4px" }}>Performance Score</span>
        </div>

        {/* Stats column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: "140px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", color: BS.textSubtle, width: "60px" }}>Level</span>
            <DiffBadge diff={currentDifficulty} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "10px", color: BS.textSubtle, width: "60px" }}>Trend</span>
            <span style={{
              background: tc.bg, color: tc.color,
              border: `1px solid ${tc.border}`,
              borderRadius: radius.full, padding: "2px 9px",
              fontSize: "10px", fontWeight: 600,
            }}>
              {tc.icon} {trend}
            </span>
          </div>
          {ptsToAdvance !== null && ptsToAdvance > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "10px", color: BS.textSubtle, width: "60px" }}>Advance</span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#059669" }}>{ptsToAdvance} pts needed</span>
            </div>
          )}
          {ptsToAdvance === 0 && (
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#059669" }}>✓ Ready to advance!</span>
          )}
          {currentDifficulty === "hard" && (
            <span style={{ fontSize: "10px", fontWeight: 600, color: BS.violet }}>★ Maximum difficulty</span>
          )}
        </div>
      </div>

      {/* Threshold bar */}
      <div style={{ marginTop: "16px" }}>
        <div style={{
          position: "relative", height: "8px", borderRadius: "4px",
          background: BS.surface, overflow: "hidden",
        }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "35%", background: "#FCA5A5", borderRadius: "4px 0 0 4px" }} />
          <div style={{ position: "absolute", left: "35%", top: 0, height: "100%", width: "40%", background: "#FDE68A" }} />
          <div style={{ position: "absolute", left: "75%", top: 0, height: "100%", width: "25%", background: "#6EE7B7", borderRadius: "0 4px 4px 0" }} />
          <div style={{
            position: "absolute", top: 0, height: "100%", width: "2px",
            background: BS.text, left: `${performanceScore}%`,
            transition: "left 0.8s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", color: BS.textSubtle, marginTop: "2px" }}>
          <span>Regress</span><span>Maintain</span><span>Advance</span>
        </div>
      </div>
    </Panel>
  );
}

/* ─── Panel 2: Personal Bests ────────────────────────────────────────────── */
function PersonalBestsPanel({ bests }) {
  const diffs = ["easy", "medium", "hard"];
  const hasAny = diffs.some((d) => bests[d] !== null);

  return (
    <Panel>
      <SectionTitle children="Personal Bests" sub="Per difficulty level" />
      {!hasAny ? <Empty msg="No completed sessions yet." /> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {["Level","Sessions","Best","Avg","Fastest","Clean Run"].map((h) => (
                  <th key={h} style={{
                    padding: "6px 8px", textAlign: "right", fontWeight: 600,
                    color: BS.textSubtle, fontSize: "10px",
                    borderBottom: `1px solid ${BS.border}`,
                    ...(h === "Level" ? { textAlign: "left" } : {}),
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {diffs.map((d) => {
                const b = bests[d];
                return (
                  <tr key={d} style={{ borderBottom: `1px solid ${BS.border}` }}>
                    <td style={{ padding: "10px 8px 10px 0" }}>
                      <DiffBadge diff={d} />
                    </td>
                    {b ? (
                      <>
                        <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 600, color: BS.text }}>{b.totalSolved}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 800, color: BS.primary }}>{b.bestScore}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px", color: BS.textMuted }}>{b.avgScore}</td>
                        <td style={{ textAlign: "right", padding: "10px 8px", color: BS.textMuted }}>{b.fastestTime}s</td>
                        <td style={{ textAlign: "right", padding: "10px 8px", fontWeight: 700, color: BS.violet }}>
                          {b.cleanStreak} <span style={{ fontWeight: 400, color: BS.textSubtle }}>days</span>
                        </td>
                      </>
                    ) : (
                      <td colSpan={5} style={{ textAlign: "center", color: BS.textSubtle, fontStyle: "italic", padding: "10px 8px" }}>
                        no sessions yet
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ─── Panel 3: Score Trend + Rolling Avg ─────────────────────────────────── */
function ScoreTrendPanel({ trend }) {
  const W=560, H=140, PAD={top:12,right:16,bottom:28,left:32};
  const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;

  if (trend.length < 2) return (
    <Panel><SectionTitle children="Score Trend" /><Empty msg="Solve at least 2 puzzles to see your trend." /></Panel>
  );

  const scores = trend.map((p) => p.score);
  const yMin   = Math.max(0,   Math.min(...scores) - 8);
  const yMax   = Math.min(100, Math.max(...scores) + 8);
  const yRange = yMax - yMin || 1;
  const n = trend.length;
  const xS = (i) => PAD.left + (i / Math.max(n-1,1)) * cW;
  const yS = (v) => PAD.top + cH - ((v - yMin) / yRange) * cH;
  const barW = Math.max(2, (cW / n) - 1);

  const avgPoints = trend.map((p,i) => p.rollingAvg !== null ? [xS(i), yS(p.rollingAvg)] : null).filter(Boolean);
  const avgPath = avgPoints.length > 1
    ? avgPoints.map((pt,i) => `${i===0?"M":"L"} ${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(" ")
    : null;

  const yTicks = [yMin, Math.round((yMin+yMax)/2), yMax];

  return (
    <Panel>
      <SectionTitle children={`Score Trend — Last ${n} Sessions`} sub="Bars = raw score · Line = 7-session rolling average" />
      <div style={{ overflowX: "auto" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: "320px" }} preserveAspectRatio="xMidYMid meet">
          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} y1={yS(tick)} x2={PAD.left+cW} y2={yS(tick)} stroke={BS.border} strokeWidth="1"/>
              <text x={PAD.left-4} y={yS(tick)+4} textAnchor="end" fontSize="9" fill={BS.textSubtle}>{tick}</text>
            </g>
          ))}
          {trend.map((point, i) => {
            const x=xS(i)-barW/2, yTop=yS(point.score), h=Math.max(1,yS(yMin)-yTop);
            return (
              <rect key={i} x={x} y={yTop} width={barW} height={h}
                    fill={DC[point.difficulty]?.hex ?? "#34d399"} opacity="0.8" rx="2">
                <title>{`${point.date} · Score ${point.score} · ${point.timeTaken}s`}</title>
              </rect>
            );
          })}
          {avgPath && (
            <path d={avgPath} fill="none" stroke={BS.violet} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"/>
          )}
          {avgPoints.map(([x,y],i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill={BS.violet}/>
          ))}
          {[0,Math.floor((n-1)/2),n-1].map((i) => (
            <text key={i} x={xS(i)} y={H-6} textAnchor="middle" fontSize="9" fill={BS.textSubtle}>
              {trend[i]?.date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
        {["easy","medium","hard"].map((d) => (
          <span key={d} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: BS.textMuted }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: DC[d].hex, display: "inline-block" }}/>
            {d}
          </span>
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: BS.textMuted }}>
          <span style={{ width: "16px", height: "2px", background: BS.violet, display: "inline-block", borderRadius: "1px" }}/>
          7-session avg
        </span>
      </div>
    </Panel>
  );
}

/* ─── Panel 4: Difficulty Progression ───────────────────────────────────── */
function DifficultyProgressionPanel({ timeline }) {
  if (timeline.length < 2) return (
    <Panel><SectionTitle children="Difficulty Progression" /><Empty msg="Solve more puzzles to see your progression arc." /></Panel>
  );

  const W=560, H=100, PAD={top:10,right:16,bottom:24,left:44};
  const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
  const n=timeline.length;
  const xS=(i)=>PAD.left+(i/Math.max(n-1,1))*cW;
  const yS=(lvl)=>PAD.top+cH-((lvl-1)/2)*cH;

  let path="";
  for(let i=0;i<n;i++){
    const x=xS(i),y=yS(timeline[i].difficultyLevel);
    if(i===0){path+=`M ${x.toFixed(1)} ${y.toFixed(1)}`;}
    else{
      path+=` L ${x.toFixed(1)} ${yS(timeline[i-1].difficultyLevel).toFixed(1)}`;
      path+=` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }

  return (
    <Panel>
      <SectionTitle children="Difficulty Progression" sub="How your adaptive difficulty has moved over all sessions" />
      <div style={{ overflowX: "auto" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ minWidth: "320px" }} preserveAspectRatio="xMidYMid meet">
          {[{lvl:1,label:"Easy"},{lvl:2,label:"Medium"},{lvl:3,label:"Hard"}].map(({lvl,label})=>{
            const y=yS(lvl), d=["easy","medium","hard"][lvl-1];
            return(
              <g key={lvl}>
                <line x1={PAD.left} y1={y} x2={PAD.left+cW} y2={y} stroke={BS.border} strokeWidth="1" strokeDasharray="3 3"/>
                <text x={PAD.left-4} y={y+4} textAnchor="end" fontSize="9" fill={DC[d].hex} fontWeight="600">{label}</text>
              </g>
            );
          })}
          <path d={path} fill="none" stroke={BS.primary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          {timeline.map((p,i)=>(
            <circle key={i} cx={xS(i)} cy={yS(p.difficultyLevel)} r="3"
                    fill={DC[p.difficulty]?.hex ?? DC.easy.hex}>
              <title>{p.date} · {p.difficulty}</title>
            </circle>
          ))}
          {[0,Math.floor((n-1)/2),n-1].map((i)=>(
            <text key={i} x={xS(i)} y={H-4} textAnchor="middle" fontSize="9" fill={BS.textSubtle}>
              {timeline[i]?.date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
    </Panel>
  );
}

/* ─── Panel 5: Speed vs Score Scatter ───────────────────────────────────── */
function SpeedScoreScatterPanel({ points }) {
  if (points.length < 3) return (
    <Panel><SectionTitle children="Speed vs Score" /><Empty msg="Solve at least 3 puzzles to see the scatter." /></Panel>
  );

  const W=320,H=200,PAD={top:10,right:16,bottom:28,left:36};
  const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
  const times=points.map((p)=>p.timeTaken), scores=points.map((p)=>p.score);
  const xMax=Math.max(...times,10)*1.1;
  const yMin=Math.max(0,Math.min(...scores)-5), yMax=Math.min(100,Math.max(...scores)+5);
  const xS=(t)=>PAD.left+(t/xMax)*cW;
  const yS=(s)=>PAD.top+cH-((s-yMin)/(yMax-yMin))*cH;
  const xTicks=[0,Math.round(xMax/2),Math.round(xMax)];
  const yTicks=[yMin,Math.round((yMin+yMax)/2),yMax];

  return (
    <Panel>
      <SectionTitle children="Speed vs Score" sub="Each dot = one session · left = faster · up = higher score" />
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ maxWidth:"320px",display:"block",margin:"0 auto" }}>
        {yTicks.map((tick)=>(
          <g key={tick}>
            <line x1={PAD.left} y1={yS(tick)} x2={PAD.left+cW} y2={yS(tick)} stroke={BS.border} strokeWidth="1"/>
            <text x={PAD.left-4} y={yS(tick)+4} textAnchor="end" fontSize="9" fill={BS.textSubtle}>{tick}</text>
          </g>
        ))}
        {xTicks.map((tick)=>(
          <text key={tick} x={xS(tick)} y={H-6} textAnchor="middle" fontSize="9" fill={BS.textSubtle}>{tick}s</text>
        ))}
        {points.map((p,i)=>(
          <circle key={i} cx={xS(p.timeTaken)} cy={yS(p.score)} r="4.5"
                  fill={DC[p.difficulty]?.hex ?? DC.easy.hex} opacity="0.75">
            <title>{`${p.date} · ${p.timeTaken}s · Score ${p.score}`}</title>
          </circle>
        ))}
        <text x={PAD.left+cW/2} y={H-1} textAnchor="middle" fontSize="9" fill={BS.textSubtle}>Time (seconds)</text>
      </svg>
      <div style={{ display: "flex", gap: "12px", marginTop: "8px", justifyContent: "center" }}>
        {["easy","medium","hard"].map((d)=>(
          <span key={d} style={{ display:"flex",alignItems:"center",gap:"4px",fontSize:"10px",color:BS.textMuted }}>
            <span style={{ width:"10px",height:"10px",borderRadius:"50%",background:DC[d].hex,display:"inline-block" }}/>
            {d}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* ─── Panel 6: Attempts Efficiency ──────────────────────────────────────── */
function AttemptsEfficiencyPanel({ breakdown }) {
  const diffs=["easy","medium","hard"];
  const hasAny=diffs.some((d)=>breakdown[d]!==null);

  return (
    <Panel>
      <SectionTitle children="Attempts Efficiency" sub="What % of sessions solved on first try?" />
      {!hasAny ? <Empty msg="No completed sessions yet." /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {diffs.map((d)=>{
            const b=breakdown[d];
            if(!b) return (
              <div key={d} style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                <DiffBadge diff={d}/>
                <span style={{ fontSize:"10px",color:BS.textSubtle,fontStyle:"italic" }}>no sessions</span>
              </div>
            );
            return (
              <div key={d}>
                <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px" }}>
                  <DiffBadge diff={d}/>
                  <span style={{ fontSize:"10px",color:BS.textMuted }}>{b.total} session{b.total!==1?"s":""}</span>
                  <span style={{ marginLeft:"auto",fontSize:"11px",fontWeight:700,color:BS.text }}>{b.firstPct}% clean</span>
                </div>
                <div style={{ height:"14px",display:"flex",borderRadius:"7px",overflow:"hidden",gap:"1px" }}>
                  {b.firstPct>0 && (
                    <div style={{ background:"#34d399",width:`${b.firstPct}%`,display:"flex",alignItems:"center",justifyContent:"center" }}
                         title={`1st: ${b.first} (${b.firstPct}%)`}>
                      {b.firstPct>=15 && <span style={{ fontSize:"8px",color:"#fff",fontWeight:700 }}>{b.firstPct}%</span>}
                    </div>
                  )}
                  {b.secondPct>0 && (
                    <div style={{ background:"#fbbf24",width:`${b.secondPct}%`,display:"flex",alignItems:"center",justifyContent:"center" }}
                         title={`2nd: ${b.second} (${b.secondPct}%)`}>
                      {b.secondPct>=15 && <span style={{ fontSize:"8px",color:"#fff",fontWeight:700 }}>{b.secondPct}%</span>}
                    </div>
                  )}
                  {b.thirdPlusPct>0 && (
                    <div style={{ background:"#f87171",width:`${b.thirdPlusPct}%`,display:"flex",alignItems:"center",justifyContent:"center" }}
                         title={`3+: ${b.thirdPlus} (${b.thirdPlusPct}%)`}>
                      {b.thirdPlusPct>=15 && <span style={{ fontSize:"8px",color:"#fff",fontWeight:700 }}>{b.thirdPlusPct}%</span>}
                    </div>
                  )}
                  {(100-b.firstPct-b.secondPct-b.thirdPlusPct)>0 && (
                    <div style={{ background:BS.border,flex:1 }}/>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display:"flex",gap:"12px",marginTop:"12px",flexWrap:"wrap" }}>
        {[{color:"#34d399",label:"1st attempt"},{color:"#fbbf24",label:"2nd attempt"},{color:"#f87171",label:"3+ attempts"}].map(({color,label})=>(
          <span key={label} style={{ display:"flex",alignItems:"center",gap:"4px",fontSize:"10px",color:BS.textMuted }}>
            <span style={{ width:"10px",height:"10px",borderRadius:"2px",background:color,display:"inline-block" }}/>
            {label}
          </span>
        ))}
      </div>
    </Panel>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────────────────────── */
export default function InsightsDashboard({ refreshKey }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await computeInsightsData()); }
    catch (err) { console.error("[InsightsDashboard]", err); setError("Could not load insights."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  if (loading) {
    return (
      <div style={{ display:"flex",flexDirection:"column",gap:"12px",width:"100%" }}>
        {[120,200,140,100,200,100].map((h,i)=>(
          <div key={i} className="skeleton" style={{ height:`${h}px`,borderRadius:radius.xl }}/>
        ))}
      </div>
    );
  }

  if (error) return (
    <Panel>
      <p style={{ color:BS.error,textAlign:"center",fontSize:"13px",padding:"16px 0" }}>{error}</p>
      <div style={{ display:"flex",justifyContent:"center" }}>
        <button onClick={loadData} style={{
          background:BS.primary,color:"#fff",border:"none",
          borderRadius:radius.md,padding:"8px 20px",
          fontSize:"13px",fontFamily:font.base,cursor:"pointer",
        }}>Retry</button>
      </div>
    </Panel>
  );

  if (!data || data.isEmpty) return (
    <Panel>
      <div style={{ textAlign:"center",padding:"40px 0" }}>
        <div style={{ fontSize:"40px",marginBottom:"12px" }}>🧩</div>
        <p style={{ fontSize:"14px",fontWeight:600,color:BS.text,margin:"0 0 4px" }}>No insights yet</p>
        <p style={{ fontSize:"12px",color:BS.textSubtle,margin:0 }}>
          Solve your first puzzle to begin tracking performance.
        </p>
      </div>
    </Panel>
  );

  const { performanceTrend, difficultyTimeline, speedScatterPoints, attemptsBreakdown, personalBests, performanceSummary } = data;

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:"12px",width:"100%" }} className="stagger">
      <AdaptiveStatusPanel     summary={performanceSummary}  />
      <PersonalBestsPanel      bests={personalBests}          />
      <ScoreTrendPanel         trend={performanceTrend}       />
      <DifficultyProgressionPanel timeline={difficultyTimeline} />
      <SpeedScoreScatterPanel  points={speedScatterPoints}    />
      <AttemptsEfficiencyPanel breakdown={attemptsBreakdown} />
    </div>
  );
}