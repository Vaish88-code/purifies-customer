import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Package, 
  Truck,
  CheckCircle,
  Phone,
  MapPin,
  Clock,
  Loader2,
  ArrowLeft,
  CreditCard,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation, useFormatCurrency } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import { subscribeToOrderById, getPaymentByOrderId, updatePaymentDocument } from '@shared/lib/firebase/firestore';
import type { Order, Payment } from '@shared/lib/firebase/firestore';
import { getOrderDisplayStatus } from '@shared/utils/orderStatus';

interface TimelineStep {
  status: string;
  label: string;
  completed: boolean;
  current: boolean;
  time?: string;
}

export default function OrderTracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const t = useTranslation();
  const formatCurrency = useFormatCurrency();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!orderId || !user?.id) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOrderById(
      orderId,
      (orderData) => {
        if (orderData && orderData.customerUid !== user.id) {
          setError('Order not found');
          setOrder(null);
        } else {
          setOrder(orderData);
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setOrder(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [orderId, user?.id]);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const p = await getPaymentByOrderId(orderId);
        setPayment(p);
      } catch {
        setPayment(null);
      }
    };
    load();
  }, [orderId]);

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading order...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (error || !order) {
    return (
      <CustomerLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <Link to="/customer">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <Card className="card-shadow">
            <CardContent className="p-12 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">Order not found</p>
              <p className="text-muted-foreground mt-1">
                {error || 'This order may not exist or you may not have access to it.'}
              </p>
              <Link to="/customer">
                <Button className="mt-4">Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </CustomerLayout>
    );
  }

  const displayStatus = getOrderDisplayStatus(order);
  const formatOrderItems = (o: Order) =>
    (o.items || []).map(item => {
      const name = item.jarType === '20L' ? '20L Jar' : item.jarType === '10L' ? '10L Jar' : 'Bottles';
      return `${item.quantity}x ${name}`;
    }).join(', ');

  // Build timeline based on real order status
  const getTimeline = (): TimelineStep[] => {
    const steps: TimelineStep[] = [
      {
        status: 'pending',
        label: 'Order Placed',
        completed: true,
        current: false,
        time: order.createdAt?.toDate().toLocaleTimeString(),
      },
      {
        status: 'confirmed',
        label: 'Order Confirmed',
        completed: ['accepted', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status),
        current: order.status === 'accepted' && !order.deliveryPersonUid,
      },
      {
        status: 'assigned',
        label: t('assignedForDelivery'),
        completed: ['accepted', 'preparing', 'out_for_delivery', 'delivered'].includes(order.status) && !!order.deliveryPersonUid,
        current: displayStatus === 'assigned_for_delivery',
      },
      {
        status: 'out_for_delivery',
        label: t('outForDelivery'),
        completed: ['out_for_delivery', 'delivered'].includes(order.status),
        current: displayStatus === 'out_for_delivery',
      },
      {
        status: 'delivered',
        label: t('jarsDelivered'),
        completed: order.status === 'delivered',
        current: order.status === 'delivered',
        time: order.status === 'delivered' ? order.updatedAt?.toDate().toLocaleTimeString() : undefined,
      },
    ];
    return steps;
  };

  const timeline = getTimeline();

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/customer">
          <Button variant="ghost" className="gap-2 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Order Tracking</h1>
          <p className="text-muted-foreground mt-1">
            Track your water delivery in real-time
          </p>
        </div>

        {/* Order Summary Card */}
        <Card className="card-shadow border-2 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl water-gradient">
                  <Package className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="font-bold text-lg">{order.orderId}</p>
                  <p className="text-muted-foreground">{formatOrderItems(order)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-2xl">{formatCurrency(order.total)}</p>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                  displayStatus === 'out_for_delivery' 
                    ? 'bg-indigo-500/10 text-indigo-600 animate-pulse' 
                    : displayStatus === 'delivered'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : displayStatus === 'assigned_for_delivery'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {displayStatus === 'out_for_delivery' && <Truck className="h-3 w-3" />}
                  {displayStatus === 'delivered' && <CheckCircle className="h-3 w-3" />}
                  {displayStatus === 'out_for_delivery' ? t('outForDelivery') :
                   displayStatus === 'delivered' ? t('delivered') :
                   displayStatus === 'assigned_for_delivery' ? t('assignedForDelivery') :
                   displayStatus === 'accepted' ? t('accepted') : t('pending')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Timeline - Real-time */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Delivery Status
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/20 text-primary ml-1">
                Live
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-1">
              {timeline.map((step, index) => (
                <div key={step.status} className="flex gap-4 pb-8 last:pb-0 relative">
                  {/* Vertical line to next step */}
                  {index < timeline.length - 1 && (
                    <div
                      className={`absolute left-4 top-10 w-0.5 h-14 ${
                        step.completed ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}

                  {/* Icon */}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      step.completed
                        ? step.current
                          ? 'water-gradient animate-pulse-slow'
                          : 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {step.completed ? (
                      step.current && step.status === 'out_for_delivery' ? (
                        <Truck className="h-4 w-4 text-primary-foreground" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-primary-foreground" />
                      )
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-0.5">
                    <p
                      className={`font-semibold ${
                        step.current ? 'text-primary' : step.completed ? '' : 'text-muted-foreground'
                      }`}
                    >
                      {step.label}
                    </p>
                    {step.time && (
                      <p className="text-sm text-muted-foreground">{step.time}</p>
                    )}
                    {step.current && step.status === 'out_for_delivery' && (
                      <p className="text-sm text-primary mt-1 font-medium">
                        Your delivery partner is on the way!
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payment Status - show until vendor confirms */}
        {payment && payment.status !== 'PAID' && (
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Amount: {formatCurrency(payment.amount)}</span>
                <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                  payment.status === 'FAILED'
                    ? 'bg-red-500/10 text-red-600'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {payment.status === 'INITIATED' && 'Awaiting your confirmation'}
                  {payment.status === 'PAYMENT_REQUESTED' && 'Waiting for vendor confirmation'}
                  {payment.status === 'FAILED' && 'Payment rejected'}
                </span>
              </div>
              {payment.status === 'INITIATED' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    After completing payment via UPI, click the button below to notify the vendor.
                  </p>
                  <Button
                    onClick={async () => {
                      if (!payment.id) return;
                      try {
                        setConfirmingPayment(true);
                        await updatePaymentDocument(payment.id, { status: 'PAYMENT_REQUESTED' });
                        setPayment({ ...payment, status: 'PAYMENT_REQUESTED' });
                        toast({ title: 'Payment submitted', description: 'Waiting for vendor confirmation.' });
                      } catch (err: any) {
                        toast({ title: 'Error', description: err.message || 'Please try again.', variant: 'destructive' });
                      } finally {
                        setConfirmingPayment(false);
                      }
                    }}
                    disabled={confirmingPayment}
                  >
                    {confirmingPayment ? 'Confirming...' : 'I Have Paid'}
                  </Button>
                </div>
              )}
              {payment.status === 'PAYMENT_REQUESTED' && (
                <p className="text-sm text-primary">
                  Waiting for vendor confirmation. You’ll be notified once the vendor approves your payment.
                </p>
              )}
              {payment.status === 'FAILED' && (
                <p className="text-sm text-destructive">
                  Vendor rejected this payment. Please place a new order or contact support.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Delivery Partner - only when assigned */}
        {order.deliveryPersonName && (
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Delivery Partner</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full water-gradient flex items-center justify-center text-xl font-bold text-primary-foreground">
                    {order.deliveryPersonName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold">{order.deliveryPersonName}</p>
                    <p className="text-sm text-muted-foreground">Delivery Partner</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => window.open(`tel:${order.deliveryPersonPhone}`, '_self')}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Delivery Address */}
        <Card className="card-shadow">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-accent">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Delivery Address</p>
                <p className="text-muted-foreground mt-1">{order.customerAddress}</p>
                {order.customerPincode && (
                  <p className="text-sm text-muted-foreground">Pincode: {order.customerPincode}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}
