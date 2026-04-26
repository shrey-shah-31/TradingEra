import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { Skeleton } from '../components/Skeleton.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';

const STATUS_COLOR = {
  COMPLETED: '#3fe397',
  CANCELLED: '#8b90a0',
  OPEN: '#adc6ff',
};

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(null);
  const [activeTab, setActiveTab] = useState('open');
  const { fmt } = useCurrency();

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/trade/orders');
      setOrders(data.orders || []);
    } catch { setOrders([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function cancel(id) {
    try {
      await api.delete(`/api/trade/order/${id}`);
      toast.success('Order cancelled');
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Cancel failed'); }
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!edit) return;
    try {
      await api.patch(`/api/trade/order/${edit._id}`, {
        quantity: edit.quantity ? Number(edit.quantity) : undefined,
        limitPrice: edit.limitPrice ? Number(edit.limitPrice) : undefined,
      });
      toast.success('Order updated');
      setEdit(null);
      load();
    } catch (e) { toast.error(e.response?.data?.message || 'Update failed'); }
  }

  const open = orders.filter((o) => o.status === 'OPEN');
  const history = orders.filter((o) => o.status !== 'OPEN');
  const displayed = activeTab === 'open' ? open : history;

  if (loading) return <Skeleton style={{ height: 400, width: '100%', borderRadius: 12 }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header bento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16 }}>
        <div style={{ background: '#1d2023', borderRadius: 12, padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, padding: 20, opacity: 0.08, pointerEvents: 'none' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 100, color: '#adc6ff' }}>analytics</span>
          </div>
          <p className="font-headline" style={{ fontSize: 10, fontWeight: 700, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
            Total Trading Volume (MTD)
          </p>
          <h1 className="font-headline" style={{ fontSize: 40, fontWeight: 900, color: '#e1e2e7', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
            {orders.length} Orders
          </h1>
          <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
            <div>
              <p style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>Open</p>
              <p className="font-headline" style={{ fontSize: 20, fontWeight: 700, color: '#adc6ff', fontVariantNumeric: 'tabular-nums' }}>{open.length}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 4 }}>Completed</p>
              <p className="font-headline" style={{ fontSize: 20, fontWeight: 700, color: '#3fe397', fontVariantNumeric: 'tabular-nums' }}>
                {orders.filter(o => o.status === 'COMPLETED').length}
              </p>
            </div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(173,198,255,0.15), #1d2023)', borderRadius: 12, padding: '24px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="font-headline" style={{ fontSize: 13, fontWeight: 700, color: '#e1e2e7' }}>Execution Score</h3>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#adc6ff' }}>bolt</span>
          </div>
          <div>
            <div className="font-headline" style={{ fontSize: 32, fontWeight: 900, color: '#e1e2e7' }}>
              98.2<span style={{ fontSize: 14, fontWeight: 500, color: '#8b90a0' }}>/100</span>
            </div>
            <p style={{ fontSize: 11, color: '#8b90a0', marginTop: 4 }}>Exceptional fill rate</p>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              <span style={{ color: '#8b90a0' }}>Fill Reliability</span>
              <span style={{ color: '#adc6ff' }}>99.9%</span>
            </div>
            <div style={{ height: 4, background: '#191c1f', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: '99.9%', background: 'linear-gradient(90deg, #adc6ff, #4b8eff)', borderRadius: 4 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Edit form */}
      {edit && (
        <motion.form
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onSubmit={saveEdit}
          style={{ background: '#1d2023', borderRadius: 12, padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}
        >
          {[
            { label: 'Quantity', key: 'quantity' },
            { label: 'Limit Price', key: 'limitPrice' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{label}</label>
              <input
                value={edit[key]}
                onChange={(e) => setEdit({ ...edit, [key]: e.target.value })}
                style={{ marginTop: 6, width: '100%', background: '#191c1f', border: 'none', borderRadius: 8, padding: '10px 12px', fontFamily: 'monospace', fontSize: 13, color: '#e1e2e7', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{ padding: '10px 20px', borderRadius: 8, background: 'linear-gradient(135deg, #adc6ff, #4b8eff)', border: 'none', color: '#002e69', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Save</button>
            <button type="button" onClick={() => setEdit(null)} style={{ padding: '10px 16px', borderRadius: 8, background: '#323538', border: 'none', color: '#c1c6d7', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          </div>
        </motion.form>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, borderBottom: '1px solid rgba(65,71,85,0.2)', paddingBottom: 0 }}>
        {[['open', 'Open Orders'], ['history', 'History']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="font-headline"
            style={{
              padding: '12px 4px',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === id ? '#adc6ff' : 'transparent'}`,
              color: activeTab === id ? '#adc6ff' : '#8b90a0',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {label}
            {id === 'open' && open.length > 0 && (
              <span style={{ marginLeft: 8, background: 'rgba(173,198,255,0.15)', color: '#adc6ff', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>
                {open.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr 2fr 3fr 2fr', gap: 16, padding: '6px 24px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#8b90a0' }}>
          <span>Instrument / Type</span>
          <span style={{ textAlign: 'right' }}>Price</span>
          <span style={{ textAlign: 'right' }}>Amount</span>
          <span>Status</span>
          <span style={{ textAlign: 'right' }}>Action</span>
        </div>

        {displayed.length === 0 && (
          <div style={{ background: '#1d2023', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#8b90a0', fontSize: 13 }}>
            No {activeTab === 'open' ? 'open' : ''} orders
          </div>
        )}

        {displayed.map((o) => {
          const isBuy = o.type === 'BUY';
          return (
            <motion.div
              key={o._id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'grid',
                gridTemplateColumns: '3fr 2fr 2fr 3fr 2fr',
                gap: 16,
                alignItems: 'center',
                background: '#1d2023',
                borderRadius: 12,
                padding: '18px 24px',
                transition: 'background 0.15s',
              }}
              className="group hover:bg-surface-container-high"
            >
              {/* Instrument */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: isBuy ? 'rgba(63,227,151,0.1)' : 'rgba(255,179,181,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isBuy ? '#3fe397' : '#ffb3b5',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                    {isBuy ? 'north_east' : 'south_east'}
                  </span>
                </div>
                <div>
                  <p className="font-headline" style={{ fontWeight: 700, color: '#e1e2e7', fontSize: 14 }}>{o.asset}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                      background: isBuy ? 'rgba(63,227,151,0.08)' : 'rgba(255,179,181,0.08)',
                      color: isBuy ? '#3be194' : '#ffb3b5',
                    }}>
                      {o.orderType} {o.type}
                    </span>
                    <span style={{ fontSize: 10, color: '#8b90a0', fontFamily: 'monospace' }}>
                      {o.assetType || 'CRYPTO'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Price */}
              <div style={{ textAlign: 'right' }}>
                <p className="font-headline" style={{ fontWeight: 700, color: '#e1e2e7', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                  {o.limitPrice != null ? fmt(o.limitPrice) : o.price != null ? fmt(o.price) : '—'}
                </p>
                <p style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', fontWeight: 700 }}>
                  {o.orderType === 'LIMIT' ? 'Limit' : 'Market'}
                </p>
              </div>

              {/* Amount */}
              <div style={{ textAlign: 'right' }}>
                <p className="font-headline" style={{ fontWeight: 700, color: '#e1e2e7', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
                  {o.quantity}
                </p>
                <p style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', fontWeight: 700 }}>Units</p>
              </div>

              {/* Status */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: STATUS_COLOR[o.status] || '#8b90a0',
                    animation: o.status === 'OPEN' ? 'pulse 1.5s infinite' : 'none',
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[o.status] || '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {o.status}
                  </span>
                </div>
                {o.exchange && (
                  <p style={{ fontSize: 10, color: '#8b90a0', marginTop: 2 }}>{o.exchange}</p>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                {o.status === 'OPEN' && (
                  <>
                    {o.orderType === 'LIMIT' && (
                      <button
                        type="button"
                        onClick={() => setEdit({ _id: o._id, quantity: o.quantity, limitPrice: o.limitPrice })}
                        style={{ padding: '7px', borderRadius: 8, background: '#323538', border: 'none', color: '#c1c6d7', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s' }}
                        className="group-hover:opacity-100"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => cancel(o._id)}
                      style={{ padding: '7px', borderRadius: 8, background: 'rgba(255,179,181,0.08)', border: 'none', color: '#ffb3b5', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s' }}
                      className="group-hover:opacity-100"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
