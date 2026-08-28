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

  const pillClass = {
    LOW: 'minimal-pill-primary',
    MEDIUM: 'minimal-pill-warning',
    HIGH: 'minimal-pill-danger',
  }[riskLevel];

  const barColor = {
    LOW: '#0044ff',
    MEDIUM: '#f97316',
    HIGH: '#ef4444',
  }[riskLevel];

  const features = data.top_features || [];

  return (
    <div style={{ marginTop: '0.75rem', padding: '1.25rem', background: '#ffffff', borderRadius: '2px', border: '1px solid #e4e4e7' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <div className="brutalist-title" style={{ fontSize: '1.05rem', color: '#111111' }}>ML Fraud & Risk Intelligence</div>
          <p className="brutalist-text" style={{ margin: 0, fontSize: '0.78rem', color: '#71717a', marginTop: '0.2rem' }}>
            Model: <strong style={{ color: '#111111' }}>{data.model || 'XGBoost+LightGBM Hybrid Ensemble'}</strong>
          </p>
        </div>
        <div className={`minimal-pill ${pillClass}`} style={{ padding: '0.35rem 0.75rem' }}>
          {riskLevel} RISK ({scorePercent}%)
        </div>
      </div>

      {/* Score vs Threshold */}
      <div style={{ marginBottom: '1.25rem', background: '#faf9f6', padding: '0.75rem', borderRadius: '2px', border: '1px solid #e4e4e7' }}>
        <div className="brutalist-text" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem', color: '#111111' }}>
          <span>Risk Score: <strong>{scorePercent}%</strong></span>
          <span>Threshold: <strong>{thresholdPercent}%</strong></span>
        </div>
        <div style={{ height: '6px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(data.risk_score * 100, 100)}%`, background: barColor }} />
        </div>
      </div>

      {/* SHAP Feature Bars */}
      {features.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <p className="brutalist-subtitle" style={{ fontSize: '0.75rem', color: '#111111', marginBottom: '0.75rem' }}>
            Top Contributing Signals (SHAP Feature Importances)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {features.map((feat, idx) => {
              const impPercent = Math.min(Math.max((feat.importance || 0) * 100, 2), 100).toFixed(1);
              const barColors = ['#0044ff', '#7c3aed', '#111111'];
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div className="brutalist-text" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#111111' }}>
                    <span style={{ fontWeight: 600 }}>{feat.label || feat.feature}</span>
                    <span style={{ color: '#71717a', fontSize: '0.75rem' }}>
                      Val: <strong>{typeof feat.value === 'number' ? feat.value.toLocaleString() : feat.value}</strong> | Importance: <strong>{impPercent}%</strong>
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#e4e4e7', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${impPercent}%`, background: barColors[idx % barColors.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Explanation */}
      {data.explanation && (
        <div className="brutalist-text" style={{ marginTop: '0.75rem', padding: '0.6rem 0.8rem', background: '#faf9f6', borderRadius: '2px', borderLeft: '4px solid #0044ff', fontSize: '0.8rem', color: '#111111', lineHeight: '1.4' }}>
          <strong>Explanation:</strong> {data.explanation}
        </div>
      )}
    </div>
  );
}
