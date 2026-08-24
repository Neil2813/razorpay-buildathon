export interface FeatureImportance {
  feature: string;
  label: string;
  importance: number;
  value: number;
}

export interface RiskFeaturesData {
  risk_score: number;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH';
  threshold?: number;
  top_features?: FeatureImportance[];
  explanation?: string;
  model?: string;
  source?: string;
}

interface Props { data: RiskFeaturesData; }

// All colors from approved palette only
// LOW risk  → #0149ae (primary)
// MED risk  → #1250b2 (primary-light)
// HIGH risk → #032676 (primary-dark)

export default function RiskFeatureChart({ data }: Props) {
  const scorePercent = (data.risk_score * 100).toFixed(2);
  const thresholdPercent = data.threshold ? (data.threshold * 100).toFixed(2) : '80.00';

  let riskLevel = data.risk_level;
  if (!riskLevel) {
    if (data.risk_score > (data.threshold || 0.8)) riskLevel = 'HIGH';
    else if (data.risk_score > 0.3) riskLevel = 'MEDIUM';
    else riskLevel = 'LOW';
  }

  const levelStyle = {
    LOW:    { bg: 'rgba(1,73,174,0.06)',    text: '#0149ae', border: 'rgba(1,73,174,0.2)',   bar: '#0149ae' },
    MEDIUM: { bg: 'rgba(18,80,178,0.08)',   text: '#1250b2', border: 'rgba(18,80,178,0.25)', bar: '#1250b2' },
    HIGH:   { bg: 'rgba(3,38,118,0.08)',    text: '#032676', border: 'rgba(3,38,118,0.25)',  bar: '#032676' },
  }[riskLevel];

  const features = data.top_features || [];

  return (
    <div style={{ marginTop: '0.75rem', padding: '1.25rem', background: '#ffffff', borderRadius: '10px', border: '1px solid rgba(1,73,174,0.12)', boxShadow: '0 4px 12px rgba(3,38,118,0.05)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e1e1e' }}>ML Fraud & Risk Intelligence</div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(30,30,30,0.5)', marginTop: '0.2rem' }}>
            Model: <strong style={{ color: '#1e1e1e' }}>{data.model || 'XGBoost+LightGBM Hybrid Ensemble'}</strong>
          </p>
        </div>
        <div style={{ padding: '0.4rem 0.8rem', borderRadius: '20px', background: levelStyle.bg, color: levelStyle.text, border: `1px solid ${levelStyle.border}`, fontWeight: 700, fontSize: '0.82rem' }}>
          {riskLevel} RISK ({scorePercent}%)
        </div>
      </div>

      {/* Score vs Threshold */}
      <div style={{ marginBottom: '1.25rem', background: '#f5f5f5', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(1,73,174,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem', color: '#1e1e1e' }}>
          <span>Risk Score: <strong>{scorePercent}%</strong></span>
          <span>Threshold: <strong>{thresholdPercent}%</strong></span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${Math.min(data.risk_score * 100, 100)}%`, background: levelStyle.bar }} />
        </div>
      </div>

      {/* SHAP Feature Bars */}
      {features.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e1e1e', marginBottom: '0.75rem' }}>
            Top Contributing Signals (SHAP Feature Importances)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {features.map((feat, idx) => {
              const impPercent = Math.min(Math.max((feat.importance || 0) * 100, 2), 100).toFixed(1);
              const barColors = ['#0149ae', '#1250b2', '#032676'];
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#1e1e1e' }}>
                    <span style={{ fontWeight: 500 }}>{feat.label || feat.feature}</span>
                    <span style={{ color: 'rgba(30,30,30,0.5)', fontSize: '0.75rem' }}>
                      Val: <strong>{typeof feat.value === 'number' ? feat.value.toLocaleString() : feat.value}</strong> | Importance: <strong>{impPercent}%</strong>
                    </span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${impPercent}%`, background: barColors[idx % barColors.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Explanation */}
      {data.explanation && (
        <div style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: 'rgba(1,73,174,0.05)', borderRadius: '6px', borderLeft: '4px solid #0149ae', fontSize: '0.8rem', color: '#032676', lineHeight: '1.4' }}>
          <strong>Explanation:</strong> {data.explanation}
        </div>
      )}
    </div>
  );
}
