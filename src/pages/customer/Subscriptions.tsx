import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Droplets,
  IndianRupee,
  MapPin,
  Package,
  Repeat,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Badge } from '@shared/components/ui/badge';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation, useFormatCurrency } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import {
  Subscription,
  SubscriptionPayment,
  Order,
  subscribeToSubscriptionsByCustomer,
  subscribeToSubscriptionPaymentsByCustomer,
  subscribeToOrdersByCustomer,
  computeSubscriptionStatus,
  createSubscriptionPaymentDocument,
  updateSubscriptionPaymentDocument,
  updateSubscriptionDocument,
  getVendorByUid,
} from '@shared/lib/firebase/firestore';
import {
  formatDeliveryDays,
  getSubscriptionJarStats,
  isPendingSubscriptionRequest,
} from '@shared/utils/subscriptionSchedule';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  PAYMENT_DUE: 'bg-red-500/10 text-red-600 border-red-500/20',
  PENDING_VERIFICATION: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  PAID: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  PAUSED: 'bg-muted text-muted-foreground border-border',
  AWAITING_APPROVAL: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  REJECTED: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const monthKey = (date: Date) => date.toISOString().slice(0, 7);

const formatMonthKey = (key: string) => {
  const [year, month] = key.split('-').map(Number);
  return `${new Date(year, month - 1).toLocaleString('default', { month: 'long' })} ${year}`;
};

const getSubscriptionDeliveryStats = (subscription: Subscription, orders: Order[]) =>
  getSubscriptionJarStats(subscription, orders);

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useTranslation();
  const formatCurrency = useFormatCurrency();

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const prevApprovalRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const unsubSubs = subscribeToSubscriptionsByCustomer(user.id, (list) => {
      setSubscriptions(list);
      setLoading(false);
    });
    const unsubPayments = subscribeToSubscriptionPaymentsByCustomer(user.id, setPayments);
    const unsubOrders = subscribeToOrdersByCustomer(user.id, setOrders);
    return () => {
      unsubSubs();
      unsubPayments();
      unsubOrders();
    };
  }, [user?.id]);

  const pendingRequest = useMemo(
    () => subscriptions.find(isPendingSubscriptionRequest),
    [subscriptions]
  );

  const activeSubscription = useMemo(() => {
    if (!subscriptions.length) return null;
    const sorted = [...subscriptions].sort(
      (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    );
    const active = sorted.find(
      (s) =>
        s.isActive === true &&
        s.isPaused !== true &&
        (s.vendorApprovalStatus === 'approved' || s.vendorApprovalStatus === undefined)
    );
    return active ?? null;
  }, [subscriptions]);

  const rejectedRequest = useMemo(
    () =>
      subscriptions.find(
        (s) => s.vendorApprovalStatus === 'rejected' && s.isActive === false
      ),
    [subscriptions]
  );

  const currentMonth = monthKey(new Date());

  useEffect(() => {
    const pendingId = pendingRequest?.id ?? null;
    const wasPendingId = prevApprovalRef.current;
    if (wasPendingId && !pendingId) {
      const approved = subscriptions.find(
        (s) =>
          s.id === wasPendingId &&
          s.vendorApprovalStatus === 'approved' &&
          s.isActive === true
      );
      if (approved) {
        toast({
          title: 'Subscription approved!',
          description: `${approved.vendorShopName} approved your request. Pay your monthly bill when due and receive scheduled deliveries.`,
        });
      }
    }
    prevApprovalRef.current = pendingId;
  }, [pendingRequest?.id, subscriptions, toast]);

  const latestPaymentForActive = useMemo(() => {
    if (!activeSubscription) return null;
    const list = payments
      .filter(
        (payment) =>
          payment.subscriptionId === activeSubscription.id && payment.month === currentMonth
      )
      .sort(
        (a, b) =>
          (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
      );
    return list[0] ?? null;
  }, [activeSubscription, payments, currentMonth]);

  const activeStatus = activeSubscription
    ? computeSubscriptionStatus(activeSubscription, latestPaymentForActive || null, new Date(), payments)
    : undefined;

  const deliveryStats = activeSubscription
    ? getSubscriptionDeliveryStats(activeSubscription, orders)
    : { deliveredJars: 0, expectedJars: 0 };

  const billHistory = useMemo(() => {
    if (!activeSubscription) return [];
    return payments
      .filter((payment) => payment.subscriptionId === activeSubscription.id)
      .sort(
        (a, b) =>
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
      );
  }, [payments, activeSubscription]);

  const shouldShowPayButton =
    !!activeSubscription &&
    (!latestPaymentForActive ||
      latestPaymentForActive.status === 'FAILED' ||
      activeStatus === 'PAYMENT_DUE');

  const handlePayMonthlyBill = async () => {
    if (!user || !activeSubscription) return;
    try {
      setPaying(true);
      const vendor = await getVendorByUid(activeSubscription.vendorUid);
      const vendorUpi = vendor?.upiId?.trim();
      if (!vendorUpi) {
        toast({
          title: 'Vendor UPI missing',
          description: 'Vendor has not configured a UPI ID yet.',
          variant: 'destructive',
        });
        return;
      }

      const amount = activeSubscription.monthlyAmount;
      await createSubscriptionPaymentDocument({
        subscriptionId: activeSubscription.id!,
        customerUid: user.id,
        customerName: user.name,
        vendorUid: activeSubscription.vendorUid,
        vendorShopName: activeSubscription.vendorShopName,
        month: currentMonth,
        amount,
        status: 'INITIATED',
      });

      const pa = encodeURIComponent(vendorUpi);
      const pn = encodeURIComponent(
        (activeSubscription.vendorShopName || 'Vendor').replace(/[^a-zA-Z0-9\s]/g, '')
      );
      const upiLink = `upi://pay?pa=${pa}&pn=${pn}&am=${amount.toFixed(2)}&cu=INR`;
      toast({
        title: 'Redirecting to UPI',
        description: 'Complete payment and then tap "I Have Paid".',
      });
      setTimeout(() => {
        window.location.href = upiLink;
      }, 800);
      await updateSubscriptionDocument(activeSubscription.id!, {
        status: 'PENDING_VERIFICATION',
      });
    } catch (error: any) {
      toast({
        title: 'Payment failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPaying(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!activeSubscription || !latestPaymentForActive?.id) return;
    try {
      setConfirmingPayment(true);
      await updateSubscriptionPaymentDocument(latestPaymentForActive.id, {
        status: 'PAYMENT_REQUESTED',
      });
      await updateSubscriptionDocument(activeSubscription.id!, {
        status: 'PENDING_VERIFICATION',
      });
      toast({
        title: 'Payment submitted',
        description: 'Waiting for vendor confirmation.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Unable to update payment.',
        variant: 'destructive',
      });
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleRestrictionClick = () => {
    if (activeStatus === 'PENDING_VERIFICATION') {
      toast({
        title: 'Waiting for confirmation',
        description: 'Vendor is verifying your payment. You can order jars once confirmed.',
        variant: 'default',
      });
    } else {
      toast({
        title: 'Payment due',
        description: 'Please clear your pending subscription bill to create new subscriptions.',
        variant: 'destructive',
      });
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading subscriptions...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (!activeSubscription && !pendingRequest && !rejectedRequest) {
    return (
      <CustomerLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="card-shadow border-dashed border-2">
            <CardContent className="p-10 text-center space-y-4">
              <Package className="h-16 w-16 text-primary mx-auto" />
              <h2 className="text-2xl font-bold">{t('subscriptions')}</h2>
              <p className="text-muted-foreground">
                You do not have an active subscription yet. Create one to enjoy discounted weekly deliveries.
              </p>
              <Button className="gap-2" onClick={() => navigate('/customer/select-shop?mode=subscription')}>
                <Droplets className="h-4 w-4" />
                Create Subscription
              </Button>
            </CardContent>
          </Card>
        </div>
      </CustomerLayout>
    );
  }

  if (pendingRequest && !activeSubscription) {
    return (
      <CustomerLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('subscriptions')}</h1>
            <p className="text-muted-foreground mt-1">Track your subscription request status</p>
          </div>
          <Card className="card-shadow border-2 border-amber-500/40 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <Repeat className="h-5 w-5" />
                Awaiting shop approval
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Your subscription request was sent to <strong>{pendingRequest.vendorShopName}</strong>.
                They will review your weekly schedule and monthly amount before activating.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-muted-foreground">Delivery days</p>
                  <p className="font-semibold">
                    {pendingRequest.deliveryDaysOfWeek?.length
                      ? formatDeliveryDays(pendingRequest.deliveryDaysOfWeek)
                      : pendingRequest.frequency}
                  </p>
                  {pendingRequest.deliveriesPerWeek && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {pendingRequest.deliveriesPerWeek}× per week
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-background">
                  <p className="text-muted-foreground">Estimated monthly bill</p>
                  <p className="font-semibold text-primary">₹{pendingRequest.monthlyAmount}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This is not a quick order. Once approved, you will pay monthly and receive jars on your selected days.
              </p>
            </CardContent>
          </Card>
        </div>
      </CustomerLayout>
    );
  }

  if (!activeSubscription && rejectedRequest) {
    return (
      <CustomerLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="card-shadow border-2 border-destructive/40">
            <CardContent className="p-8 text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Subscription request declined</h2>
              <p className="text-muted-foreground">
                {rejectedRequest.vendorShopName} could not fulfill your subscription request. You can choose
                another shop or place quick orders instead.
              </p>
              <Button onClick={() => navigate('/customer/select-shop?mode=subscription')}>
                Try another shop
              </Button>
            </CardContent>
          </Card>
        </div>
      </CustomerLayout>
    );
  }

  if (!activeSubscription) {
    return null;
  }

  const statusBadge =
    statusStyles[activeStatus || 'ACTIVE'] || 'bg-muted text-muted-foreground border-border';

  return (
    <CustomerLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">My Subscription</h1>
            <p className="text-muted-foreground mt-1">
              View subscription details, pay monthly bills, and track history.
            </p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            disabled={activeStatus === 'PAYMENT_DUE' || activeStatus === 'PENDING_VERIFICATION'}
            onClick={
              activeStatus === 'PAYMENT_DUE' || activeStatus === 'PENDING_VERIFICATION'
                ? handleRestrictionClick
                : () => navigate('/customer/select-shop?mode=subscription')
            }
          >
            <Droplets className="h-4 w-4" />
            Create Another
          </Button>
        </div>

        {/* Only show payment due for active subscriptions; paused/removed ones don't block ordering */}
        {activeStatus === 'PAYMENT_DUE' && activeSubscription.isPaused !== true && (
          <Card className="border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-400">
                  Your monthly bill is due. Please complete the payment to continue service.
                </p>
                <p className="text-sm text-red-600 dark:text-red-400/80">
                  Quick orders and new subscriptions are blocked until you clear the dues.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {activeStatus === 'PAUSED' && (
          <Card className="border-muted bg-muted/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-semibold text-muted-foreground">
                  This subscription is paused
                </p>
                <p className="text-sm text-muted-foreground">
                  You can still place quick orders or create another subscription.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {activeStatus === 'PENDING_VERIFICATION' && (
          <Card className="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="p-4 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-300">
                  Waiting for vendor confirmation
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-400/80">
                  You have paid. The vendor will verify receipt and confirm. You can order jars once confirmed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="card-shadow">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl">{activeSubscription.vendorShopName}</CardTitle>
              <p className="text-sm text-muted-foreground">{activeSubscription.vendorAddress}</p>
            </div>
            <Badge className={statusBadge}>{activeStatus || 'ACTIVE'}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase">Jar & Quantity</p>
                <p className="font-semibold text-lg">
                  {activeSubscription.quantity}x{' '}
                  {activeSubscription.jarType === 'jar20L'
                    ? '20L Jar'
                    : activeSubscription.jarType === 'jar10L'
                    ? '10L Jar'
                    : 'Bottle Pack'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase">Weekly schedule</p>
                <p className="font-semibold text-lg">
                  {activeSubscription.deliveryDaysOfWeek?.length
                    ? formatDeliveryDays(activeSubscription.deliveryDaysOfWeek)
                    : activeSubscription.frequency}
                </p>
                {activeSubscription.deliveriesPerWeek && (
                  <p className="text-sm text-muted-foreground">
                    {activeSubscription.deliveriesPerWeek}× per week
                  </p>
                )}
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase">Cycle</p>
                <p className="font-semibold text-lg flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {activeSubscription.startDate}
                  {activeSubscription.endDate && <> – {activeSubscription.endDate}</>}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground uppercase">Monthly Bill</p>
                <p className="font-semibold text-lg flex items-center gap-1">
                  <IndianRupee className="h-4 w-4" />
                  {formatCurrency(activeSubscription.monthlyAmount)}
                </p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Delivered this month</p>
                  <p className="text-2xl font-bold text-primary">
                    {deliveryStats.deliveredJars}/{deliveryStats.expectedJars}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Jars delivered for current billing cycle
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-secondary/5 border-secondary/20">
                <CardContent className="p-4 space-y-1">
                  <p className="text-xs text-muted-foreground uppercase">Remaining jars</p>
                  <p className="text-2xl font-bold text-secondary">
                    {Math.max(0, deliveryStats.expectedJars - deliveryStats.deliveredJars)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Based on selected delivery frequency
                  </p>
                </CardContent>
              </Card>
            </div>

        <div className="space-y-2">
          {shouldShowPayButton && (
                <Button
                  className="w-full sm:w-auto gap-2"
                  onClick={handlePayMonthlyBill}
                  disabled={paying}
                >
                  <IndianRupee className="h-4 w-4" />
                  {paying ? 'Redirecting...' : 'Pay Monthly Bill'}
                </Button>
              )}

              {latestPaymentForActive?.status === 'INITIATED' && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleConfirmPayment}
                  disabled={confirmingPayment}
                >
                  {confirmingPayment ? 'Submitting...' : 'I Have Paid'}
                </Button>
              )}

              {latestPaymentForActive?.status === 'PAYMENT_REQUESTED' && (
                <p className="text-sm text-amber-600">
                  Waiting for vendor confirmation. You will be notified once approved.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />
              Monthly Bill History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {billHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bills generated yet.</p>
            ) : (
              billHistory.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b last:border-b-0"
                >
                  <div>
                    <p className="font-semibold">{formatMonthKey(payment.month)}</p>
                    <p className="text-xs text-muted-foreground">{activeSubscription.vendorShopName}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      {payment.amount}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        payment.status === 'PAID'
                          ? 'text-emerald-600 border-emerald-200'
                          : payment.status === 'FAILED'
                          ? 'text-red-600 border-red-200'
                          : 'text-amber-600 border-amber-200'
                      }
                    >
                      {payment.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Delivery Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-semibold">{user.address || 'No address found'}</p>
            <p className="text-muted-foreground">{user.state}</p>
            {user.pincode && <p className="text-muted-foreground">Pincode: {user.pincode}</p>}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/customer/profile')}>
              Update Address
            </Button>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}

