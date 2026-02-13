import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseProject';

export function PaymentCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const trxnref = searchParams.get('trxref');
  const paymentType = searchParams.get('type');
  const ref = reference || trxnref;

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!ref) {
      navigate('/', { replace: true });
      return;
    }

    // Handle wallet top-up separately
    if (paymentType === 'topup') {
      navigate(`/buyer?payment=success&reference=${ref}`, { replace: true });
      return;
    }

    verifyPayment(ref);
  }, [ref]);

  const verifyPayment = async (paymentRef: string) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/paystack-api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ reference: paymentRef }),
      });
      const result = await response.json();

      if (result.success) {
        setStatus('success');
        setMessage('Payment verified successfully!');
        // Redirect to buy page or success page after short delay
        const linkId = sessionStorage.getItem('pendingPaymentLinkId');
        setTimeout(() => {
          if (linkId) {
            sessionStorage.removeItem('pendingPaymentLinkId');
            navigate(`/buy/${linkId}?payment=success&reference=${paymentRef}`, { replace: true });
          } else {
            navigate(`/buyer?payment=success&reference=${paymentRef}`, { replace: true });
          }
        }, 2000);
      } else {
        setStatus('failed');
        setMessage(result.error || 'Payment verification failed. Please contact support.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setStatus('failed');
      setMessage('Unable to verify payment. Please contact support.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        {status === 'verifying' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <h2 className="mt-4 text-xl font-bold text-foreground">Verifying Payment...</h2>
            <p className="mt-2 text-muted-foreground">Please wait while we confirm your payment with Paystack.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">Payment Successful!</h2>
            <p className="mt-2 text-muted-foreground">{message}</p>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting you shortly...</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-foreground">Verification Failed</h2>
            <p className="mt-2 text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Return Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
