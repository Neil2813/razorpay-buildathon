import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, User, Shield } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'buyer' | 'merchant_admin'>('buyer');
  
  // Buyer-specific address fields
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Merchant-specific fields
  const [tenantId, setTenantId] = useState('demo_tenant');
  const [companyName, setCompanyName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [whLine1, setWhLine1] = useState('');
  const [whCity, setWhCity] = useState('');
  const [whState, setWhState] = useState('');
  const [whPincode, setWhPincode] = useState('');
  const [coverageType, setCoverageType] = useState('all_india');
  const [coverageValue, setCoverageValue] = useState('');
  const [shippingFee, setShippingFee] = useState(50);
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');

  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Simple validation
    if (role === 'buyer') {
      if (!phone || !line1 || !city || !state || !pincode) {
        setError('Please fill in all delivery address fields.');
        return;
      }
      if (!/^\d{6}$/.test(pincode)) {
        setError('PIN code must be exactly 6 digits.');
        return;
      }
    } else if (role === 'merchant_admin') {
      if (!companyName || !whLine1 || !whCity || !whState || !whPincode) {
        setError('Please fill in company name and primary warehouse location.');
        return;
      }
      if (!/^\d{6}$/.test(whPincode)) {
        setError('Warehouse PIN code must be 6 digits.');
        return;
      }
    }

    try {
      const payload: any = {
        email,
        password,
        full_name: name,
        role
      };

      if (role === 'buyer') {
        payload.phone = phone;
        payload.address_line1 = line1;
        payload.address_line2 = line2 || undefined;
        payload.address_city = city;
        payload.address_state = state;
        payload.address_pincode = pincode;
      } else {
        payload.tenant_id = tenantId || 'demo_tenant';
        payload.company_name = companyName;
        payload.support_email = supportEmail || email;
        payload.support_phone = supportPhone;
        payload.warehouse_line1 = whLine1;
        payload.warehouse_city = whCity;
        payload.warehouse_state = whState;
        payload.warehouse_pincode = whPincode;
        payload.coverage_type = coverageType;
        payload.coverage_value = coverageType === 'all_india' ? 'all' : (coverageValue || whCity);
        payload.shipping_fee = Number(shippingFee) || 0;
        payload.delivery_days = Number(deliveryDays) || 3;
        payload.razorpay_key_id = razorpayKeyId || undefined;
        payload.razorpay_key_secret = razorpayKeySecret || undefined;
      }

      await register(payload);
      
      if (role === 'merchant_admin') {
        navigate('/dashboard');
      } else {
        navigate('/checkout');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#faf9f6' }}>
      <Navbar />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div className="minimal-card" style={{ maxWidth: '480px', width: '100%', textAlign: 'center', padding: '2rem' }}>
          <div className="brutalist-subtitle" style={{ marginBottom: '0.5rem', color: '#0044ff' }}>GLASSBOX REGISTER</div>
          <h2 className="brutalist-title" style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>Create Account</h2>
          <p className="brutalist-text" style={{ margin: '0 0 1.5rem 0', color: '#71717a', fontSize: '0.9rem' }}>Join the autonomous shopping ecosystem</p>
          
          {error && (
            <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '2px', color: '#ef4444', fontSize: '0.85rem', textAlign: 'left', fontFamily: 'Space Grotesk' }}>
              {error}
            </div>
          )}

          {/* Role selector */}
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f4f4f5', padding: '4px', borderRadius: '2px', border: '1px solid #e4e4e7', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => { setRole('buyer'); setError(''); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '2px', border: 'none', cursor: 'pointer',
                background: role === 'buyer' ? '#0044ff' : 'transparent',
                color: role === 'buyer' ? '#ffffff' : '#71717a',
                transition: 'all 0.15s',
                fontFamily: 'Space Grotesk'
              }}
            >
              <User size={14} /> Buyer Account
            </button>
            <button
              type="button"
              onClick={() => { setRole('merchant_admin'); setError(''); }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.5rem', fontSize: '0.8rem', fontWeight: 700, borderRadius: '2px', border: 'none', cursor: 'pointer',
                background: role === 'merchant_admin' ? '#0044ff' : 'transparent',
                color: role === 'merchant_admin' ? '#ffffff' : '#71717a',
                transition: 'all 0.15s',
                fontFamily: 'Space Grotesk'
              }}
            >
              <Shield size={14} /> Merchant Admin
            </button>
          </div>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' }}>
            <div>
              <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Full Name</label>
              <input 
                type="text" 
                placeholder="Jane Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="minimal-input"
              />
            </div>

            <div>
              <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Email Address</label>
              <input 
                type="email" 
                placeholder="jane@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="minimal-input"
              />
            </div>

            <div>
              <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Min 6 characters" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="minimal-input"
                  style={{ paddingRight: '2.8rem' }}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 0 }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Buyer fields */}
            {role === 'buyer' && (
              <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="brutalist-subtitle" style={{ color: '#0044ff', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Delivery Address Setup</div>
                
                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Phone Number</label>
                  <input 
                    type="tel" 
                    placeholder="E.g. 9876543210" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="minimal-input"
                  />
                </div>

                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Address Line 1</label>
                  <input 
                    type="text" 
                    placeholder="House/Apartment No, Street Name" 
                    value={line1}
                    onChange={(e) => setLine1(e.target.value)}
                    required
                    className="minimal-input"
                  />
                </div>

                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#71717a', display: 'block', marginBottom: '0.25rem' }}>Address Line 2 (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="Landmark, Area Details" 
                    value={line2}
                    onChange={(e) => setLine2(e.target.value)}
                    className="minimal-input"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>City</label>
                    <input 
                      type="text" 
                      placeholder="Bengaluru" 
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      className="minimal-input"
                    />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>State</label>
                    <input 
                      type="text" 
                      placeholder="Karnataka" 
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      className="minimal-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>PIN Code</label>
                  <input 
                    type="text" 
                    placeholder="6 digits, e.g. 560001" 
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    required
                    className="minimal-input"
                  />
                </div>
              </div>
            )}

            {/* Merchant fields */}
            {role === 'merchant_admin' && (
              <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div className="brutalist-subtitle" style={{ color: '#0044ff', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Merchant Profile & Operations</div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Tenant Identifier</label>
                    <input type="text" placeholder="e.g. apex_store" value={tenantId} onChange={e => setTenantId(e.target.value)} required className="minimal-input" />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Company / Store Name</label>
                    <input type="text" placeholder="Apex Retail Ltd" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="minimal-input" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#71717a', display: 'block', marginBottom: '0.25rem' }}>Support Email</label>
                    <input type="email" placeholder="support@apex.com" value={supportEmail} onChange={e => setSupportEmail(e.target.value)} className="minimal-input" />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#71717a', display: 'block', marginBottom: '0.25rem' }}>Support Phone</label>
                    <input type="tel" placeholder="080-12345678" value={supportPhone} onChange={e => setSupportPhone(e.target.value)} className="minimal-input" />
                  </div>
                </div>

                <div className="brutalist-subtitle" style={{ color: '#0044ff', fontSize: '0.75rem', marginTop: '0.4rem', marginBottom: '0.1rem' }}>Primary Warehouse Location</div>
                <div>
                  <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Warehouse Address Line 1</label>
                  <input type="text" placeholder="88 Commerce Park" value={whLine1} onChange={e => setWhLine1(e.target.value)} required className="minimal-input" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>City</label>
                    <input type="text" placeholder="Bengaluru" value={whCity} onChange={e => setWhCity(e.target.value)} required className="minimal-input" />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>State</label>
                    <input type="text" placeholder="Karnataka" value={whState} onChange={e => setWhState(e.target.value)} required className="minimal-input" />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>PIN Code</label>
                    <input type="text" placeholder="560001" value={whPincode} onChange={e => setWhPincode(e.target.value)} required className="minimal-input" />
                  </div>
                </div>

                <div className="brutalist-subtitle" style={{ color: '#0044ff', fontSize: '0.75rem', marginTop: '0.4rem', marginBottom: '0.1rem' }}>Delivery Coverage Area</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Coverage Scope</label>
                    <select value={coverageType} onChange={e => setCoverageType(e.target.value)} className="minimal-input" style={{ background: '#ffffff' }}>
                      <option value="all_india">All India (Entire Country)</option>
                      <option value="state">State Restricted</option>
                      <option value="city">City Restricted</option>
                      <option value="pincode">Pincode Restricted</option>
                    </select>
                  </div>
                  {coverageType !== 'all_india' && (
                    <div>
                      <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Target Location Value</label>
                      <input type="text" placeholder="e.g. Karnataka / Bengaluru / 560001" value={coverageValue} onChange={e => setCoverageValue(e.target.value)} required className="minimal-input" />
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Shipping Fee (₹)</label>
                    <input type="number" placeholder="50" value={shippingFee} onChange={e => setShippingFee(Number(e.target.value) || 0)} required className="minimal-input" />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#111111', display: 'block', marginBottom: '0.25rem' }}>Delivery Timeline (Days)</label>
                    <input type="number" placeholder="3" value={deliveryDays} onChange={e => setDeliveryDays(Number(e.target.value) || 1)} required className="minimal-input" />
                  </div>
                </div>

                <div className="brutalist-subtitle" style={{ color: '#0044ff', fontSize: '0.75rem', marginTop: '0.4rem', marginBottom: '0.1rem' }}>Razorpay Test Gateway (Optional)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#71717a', display: 'block', marginBottom: '0.25rem' }}>Razorpay Key ID</label>
                    <input type="text" placeholder="rzp_test_..." value={razorpayKeyId} onChange={e => setRazorpayKeyId(e.target.value)} className="minimal-input" />
                  </div>
                  <div>
                    <label className="brutalist-subtitle" style={{ fontSize: '0.7rem', color: '#71717a', display: 'block', marginBottom: '0.25rem' }}>Razorpay Key Secret</label>
                    <input type="password" placeholder="Key Secret..." value={razorpayKeySecret} onChange={e => setRazorpayKeySecret(e.target.value)} className="minimal-input" />
                  </div>
                </div>
              </div>
            )}

            <button type="submit" className="minimal-btn minimal-btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem' }}>
              Register & Continue
            </button>
          </form>
          
          <div className="brutalist-text" style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#71717a' }}>
            Already have an account? <Link to="/login" style={{ color: '#0044ff', fontWeight: 700, textDecoration: 'none' }}>Log In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
