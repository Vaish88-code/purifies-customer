import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Minus,
  Check,
  ChevronRight,
  Store,
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import { getVendorByUid, createSubscriptionDocument } from '@shared/lib/firebase/firestore';
import { Vendor } from '@shared/lib/firebase/firestore';
import { useSubscriptionRestriction } from '@shared/hooks/use-subscription-restriction';
import {
  WEEKDAYS,
  WeekdayId,
  calculateMonthlyAmountFromSchedule,
  deriveFrequencyFromDeliveriesPerWeek,
  formatDeliveryDays,
  jarTypeToSubscription,
} from '@shared/utils/subscriptionSchedule';

type JarType = '20L' | '10L' | 'bottles';

const defaultPrices = {
  '20L': 40,
  '10L': 25,
  bottles: 120,
};

export default function CreateSubscription() {
  const [searchParams] = useSearchParams();
  const shopId = searchParams.get('shopId');
  const [selectedJar, setSelectedJar] = useState<JarType>('20L');
  const [quantity, setQuantity] = useState(1);
  const [selectedDays, setSelectedDays] = useState<WeekdayId[]>([]);
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [step, setStep] = useState(1);
  const [shop, setShop] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useTranslation();
  const { hasDue } = useSubscriptionRestriction();

  useEffect(() => {
    const fetchShop = async () => {
      if (!shopId) {
        toast({
          title: 'No shop selected',
          description: 'Please select a shop first.',
          variant: 'destructive',
        });
        navigate('/customer/select-shop?mode=subscription');
        return;
      }

      try {
        setLoading(true);
        const shopData = await getVendorByUid(shopId);
        if (!shopData || shopData.status !== 'approved') {
          toast({
            title: 'Shop not available',
            description: 'The selected shop is not available.',
            variant: 'destructive',
          });
          navigate('/customer/select-shop?mode=subscription');
          return;
        }
        setShop(shopData);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load shop details.',
          variant: 'destructive',
        });
        navigate('/customer/select-shop?mode=subscription');
      } finally {
        setLoading(false);
      }
    };

    fetchShop();
  }, [shopId, navigate, toast]);

  const getPrice = (jarType: JarType): number => {
    if (!shop?.prices) return defaultPrices[jarType];
    switch (jarType) {
      case '20L':
        return shop.prices.jar20L || defaultPrices['20L'];
      case '10L':
        return shop.prices.jar10L || defaultPrices['10L'];
      case 'bottles':
        return shop.prices.bottles || defaultPrices.bottles;
    }
  };

  const jarOptions = [
    { type: '20L' as JarType, name: '20 Liter Jar', price: getPrice('20L'), image: '🫙' },
    { type: '10L' as JarType, name: '10 Liter Jar', price: getPrice('10L'), image: '🏺' },
    { type: 'bottles' as JarType, name: '1L Bottles (Pack of 12)', price: getPrice('bottles'), image: '🍶' },
  ];

  const selectedJarInfo = jarOptions.find((j) => j.type === selectedJar)!;
  const deliveriesPerWeek = selectedDays.length;
  const pricing = useMemo(
    () =>
      deliveriesPerWeek > 0
        ? calculateMonthlyAmountFromSchedule(quantity, selectedJarInfo.price, deliveriesPerWeek)
        : { monthlyAmount: 0, savings: 0, deliveriesPerMonth: 0 },
    [quantity, selectedJarInfo.price, deliveriesPerWeek]
  );

  const toggleDay = (day: WeekdayId) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleProceed = async () => {
    if (hasDue) {
      toast({
        title: 'Payment due',
        description: 'Please clear your existing subscription bill before creating a new request.',
        variant: 'destructive',
      });
      navigate('/customer/subscriptions');
      return;
    }

    if (step < 3) {
      if (step === 2 && selectedDays.length === 0) {
        toast({
          title: 'Select delivery days',
          description: 'Choose at least one day of the week for jar delivery.',
          variant: 'destructive',
        });
        return;
      }
      setStep(step + 1);
      return;
    }

    if (!user || !shop) return;

    if (!user.address?.trim()) {
      toast({
        title: 'Address required',
        description: 'Please add your delivery address in profile settings first.',
        variant: 'destructive',
      });
      navigate('/customer/profile');
      return;
    }

    try {
      setSubmitting(true);
      const frequency = deriveFrequencyFromDeliveriesPerWeek(deliveriesPerWeek);
      const today = new Date().toISOString().split('T')[0];

      await createSubscriptionDocument({
        customerUid: user.id,
        customerName: user.name,
        customerPhone: user.phone,
        customerAddress: user.address,
        customerPincode: user.pincode,
        vendorUid: shop.uid,
        vendorShopName: shop.shopName,
        vendorAddress: shop.address,
        vendorPhone: shop.phone,
        jarType: jarTypeToSubscription(selectedJar),
        quantity,
        pricePerUnit: selectedJarInfo.price,
        frequency,
        deliveryDaysOfWeek: selectedDays,
        deliveriesPerWeek,
        preferredDeliveryTime: preferredTime,
        vendorApprovalStatus: 'pending',
        isActive: false,
        isPaused: false,
        startDate: today,
        monthlyAmount: pricing.monthlyAmount,
        savings: pricing.savings,
      });

      toast({
        title: 'Subscription request sent',
        description: `${shop.shopName} will review your request. You will see the status on My Subscriptions.`,
      });
      navigate('/customer/subscriptions');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to submit subscription request.';
      toast({
        title: 'Request failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading shop details...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (!shop) return null;

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/customer/select-shop?mode=subscription')}
            className="gap-2 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Change Shop
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold">Create Subscription</h1>
          <p className="text-muted-foreground mt-1">
            Set your weekly delivery schedule. Your request goes to the shop for approval — not as a quick order.
          </p>

          <Card className="card-shadow mt-4">
            <CardContent className="p-4 flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">{shop.shopName}</p>
                <p className="text-sm text-muted-foreground">{shop.address}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { num: 1, label: t('selectJarType') },
            { num: 2, label: 'Weekly delivery schedule' },
            { num: 3, label: 'Review & submit' },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap ${
                  step >= s.num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-bold">
                  {step > s.num ? <Check className="h-4 w-4" /> : s.num}
                </span>
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {step >= 1 && (
              <Card className={`card-shadow ${step === 1 ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader>
                  <CardTitle>1. {t('selectJarType')} & quantity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3">
                    {jarOptions.map((jar) => (
                      <button
                        key={jar.type}
                        type="button"
                        onClick={() => setSelectedJar(jar.type)}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                          selectedJar === jar.type
                            ? 'border-primary bg-accent'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <span className="text-4xl">{jar.image}</span>
                        <div className="flex-1 text-left">
                          <p className="font-semibold">{jar.name}</p>
                          <p className="text-sm text-muted-foreground">Per delivery unit</p>
                        </div>
                        <p className="font-bold">₹{jar.price}</p>
                        {selectedJar === jar.type && <Check className="h-5 w-5 text-primary" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-6 pt-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-full"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <div className="text-center">
                      <span className="text-4xl font-bold">{quantity}</span>
                      <p className="text-sm text-muted-foreground">jars per delivery</p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-12 w-12 rounded-full"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step >= 2 && (
              <Card className={`card-shadow ${step === 2 ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    2. Which days do you want delivery?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select every day of the week you want water jars delivered. Each selected day counts as one
                    delivery per week ({deliveriesPerWeek} time{deliveriesPerWeek !== 1 ? 's' : ''} per week).
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {WEEKDAYS.map((day) => {
                      const selected = selectedDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                            selected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/40'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                  {selectedDays.length > 0 && (
                    <p className="text-sm font-medium text-primary">
                      {deliveriesPerWeek} delivery{deliveriesPerWeek !== 1 ? 'ies' : ''} per week on{' '}
                      {formatDeliveryDays(selectedDays)}
                    </p>
                  )}
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="preferredTime" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Preferred delivery time
                    </Label>
                    <Input
                      id="preferredTime"
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {step >= 3 && (
              <Card className={`card-shadow ${step === 3 ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader>
                  <CardTitle>3. Review your subscription request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Jar & quantity</p>
                      <p className="font-semibold">
                        {quantity}× {selectedJarInfo.name} @ ₹{selectedJarInfo.price}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-muted-foreground">Weekly schedule</p>
                      <p className="font-semibold">{formatDeliveryDays(selectedDays)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {deliveriesPerWeek}× per week · around {preferredTime}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-muted-foreground">Delivery address</p>
                      <p className="font-semibold">{user?.address}</p>
                      {user?.pincode && (
                        <p className="text-xs text-muted-foreground">Pincode: {user.pincode}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground border-t pt-3">
                    After you submit, {shop.shopName} will approve or reject your request. Once approved, you can pay
                    your monthly bill and receive scheduled deliveries. This does not create a quick order.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-1">
            <Card className="card-shadow sticky top-24">
              <CardHeader>
                <CardTitle>Estimated monthly bill</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {deliveriesPerWeek > 0 ? (
                  <>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          {deliveriesPerWeek}×/week × 4 weeks × {quantity} jar(s)
                        </span>
                        <span>₹{pricing.monthlyAmount + pricing.savings}</span>
                      </div>
                      {pricing.savings > 0 && (
                        <div className="flex justify-between text-success">
                          <span>Subscription savings</span>
                          <span>-₹{pricing.savings}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-3 flex justify-between font-bold text-lg">
                      <span>Monthly total</span>
                      <span className="text-primary">₹{pricing.monthlyAmount}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select delivery days to see your estimated monthly amount.
                  </p>
                )}

                <Button
                  onClick={handleProceed}
                  className="w-full water-gradient text-primary-foreground font-semibold"
                  size="lg"
                  disabled={submitting || (step === 2 && selectedDays.length === 0)}
                >
                  {submitting
                    ? 'Submitting...'
                    : step < 3
                    ? 'Continue'
                    : 'Submit subscription request'}
                  {!submitting && <ChevronRight className="h-4 w-4 ml-2" />}
                </Button>

                {step > 1 && (
                  <Button variant="ghost" className="w-full" onClick={() => setStep(step - 1)}>
                    Go Back
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
