import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Droplets, 
  Plus, 
  Minus, 
  Calendar,
  Clock,
  Package,
  Check,
  ChevronRight,
  Truck,
  Store,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';
import { getVendorByUid, createOrderDocument, createPaymentDocument } from '@shared/lib/firebase/firestore';
import { Vendor } from '@shared/lib/firebase/firestore';
import { useSubscriptionRestriction } from '@shared/hooks/use-subscription-restriction';

type JarType = '20L' | '10L' | 'bottles';
type DeliveryType = 'today' | 'schedule';

const deliveryOptions: { type: DeliveryType; name: string; description: string; icon: typeof Truck }[] = [
  { type: 'today', name: 'Today', description: 'Quick delivery within 2 hours', icon: Truck },
  { type: 'schedule', name: 'Schedule', description: 'Pick a date & time', icon: Calendar },
];

const defaultPrices = {
  '20L': 40,
  '10L': 25,
  'bottles': 120,
};

export default function OrderWater() {
  const [searchParams] = useSearchParams();
  const shopId = searchParams.get('shopId');
  const [selectedJar, setSelectedJar] = useState<JarType>('20L');
  const [quantity, setQuantity] = useState(1);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('today');
  const [step, setStep] = useState(1);
  const [shop, setShop] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [autoGeocodeAttempted, setAutoGeocodeAttempted] = useState(false);
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
        navigate('/customer/select-shop');
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
          navigate('/customer/select-shop');
          return;
        }
        setShop(shopData);
      } catch (error) {
        console.error('Error fetching shop:', error);
        toast({
          title: 'Error',
          description: 'Failed to load shop details.',
          variant: 'destructive',
        });
        navigate('/customer/select-shop');
      } finally {
        setLoading(false);
      }
    };

    fetchShop();
  }, [shopId, navigate, toast]);

  const geocodeAddressFromProfile = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (!user?.address) return null;
    try {
      const searchQuery = encodeURIComponent(
        `${user.address} ${user.pincode || ''} India`
      );
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${searchQuery}&limit=1`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch coordinates from address.');
      }
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          latitude: parseFloat(data[0].lat),
          longitude: parseFloat(data[0].lon),
        };
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
    }
    return null;
  };

  const handleUseCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation is not supported on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
        setLocating(false);
      },
      (error) => {
        console.error('Error getting current location:', error);
        setLocationError(error.message || 'Unable to fetch current location.');
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
      }
    );
  };

  // Prefer device location for accurate delivery pin; fallback to geocoding saved address
  useEffect(() => {
    if (!coords && user?.address && !autoGeocodeAttempted) {
      setAutoGeocodeAttempted(true);
      (async () => {
        if ('geolocation' in navigator) {
          setLocating(true);
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setCoords({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              });
              setLocationError(null);
              setLocating(false);
            },
            () => {
              // User denied or failed: fallback to geocoding address
              (async () => {
                const geocoded = await geocodeAddressFromProfile();
                if (geocoded) {
                  setCoords(geocoded);
                  setLocationError(null);
                } else if (!locationError) {
                  setLocationError('Allow location for accurate delivery pin, or use saved address.');
                }
                setLocating(false);
              })();
            },
            { enableHighAccuracy: true, timeout: 15000 }
          );
        } else {
          setLocating(true);
          const geocoded = await geocodeAddressFromProfile();
          if (geocoded) {
            setCoords(geocoded);
            setLocationError(null);
          } else if (!locationError) {
            setLocationError('Unable to detect location. Please allow location access.');
          }
          setLocating(false);
        }
      })();
    }
  }, [coords, user?.address, user?.pincode, autoGeocodeAttempted, locationError]);

  // Get prices from shop or use defaults
  const getPrice = (jarType: JarType): number => {
    if (!shop?.prices) return defaultPrices[jarType];
    
    switch (jarType) {
      case '20L':
        return shop.prices.jar20L || defaultPrices['20L'];
      case '10L':
        return shop.prices.jar10L || defaultPrices['10L'];
      case 'bottles':
        return shop.prices.bottles || defaultPrices['bottles'];
      default:
        return defaultPrices[jarType];
    }
  };

  const jarOptions: { type: JarType; name: string; price: number; image: string }[] = [
    { type: '20L', name: '20 Liter Jar', price: getPrice('20L'), image: '🫙' },
    { type: '10L', name: '10 Liter Jar', price: getPrice('10L'), image: '🏺' },
    { type: 'bottles', name: '1L Bottles (Pack of 12)', price: getPrice('bottles'), image: '🍶' },
  ];

  const selectedJarInfo = jarOptions.find(j => j.type === selectedJar)!;
  const subtotal = selectedJarInfo.price * quantity;
  const deliveryFee = deliveryType === 'today' ? 20 : 0;
  const total = subtotal + deliveryFee;

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading shop details...</p>
        </div>
      </CustomerLayout>
    );
  }

  if (!shop) {
    return null;
  }

  const handleProceed = async () => {
    if (hasDue) {
      toast({
        title: 'Payment due',
        description: 'Please clear your subscription bill before placing new orders.',
        variant: 'destructive',
      });
      navigate('/customer/subscriptions');
      return;
    }
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Final step: Place order
    if (!user || !shop) {
      toast({
        title: 'Error',
        description: 'User or shop information is missing. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    // Validate scheduled delivery
    if (deliveryType === 'schedule') {
      if (!scheduledDate || !scheduledTime) {
        toast({
          title: 'Schedule required',
          description: 'Please select both date and time for scheduled delivery.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setPlacingOrder(true);

      let deliveryCoords = coords;
      if (!deliveryCoords) {
        setLocating(true);
        deliveryCoords = await geocodeAddressFromProfile();
        setLocating(false);
        if (deliveryCoords) {
          setCoords(deliveryCoords);
          setLocationError(null);
        } else {
          setLocationError('Location is required for delivery tracking. Please enable location access.');
          toast({
            title: 'Location required',
            description: 'Enable location access or allow us to geocode your saved address to continue.',
            variant: 'destructive',
          });
          return;
        }
      }
      
      // Prepare order data
      const orderData: any = {
        customerUid: user.id,
        customerName: user.name,
        customerPhone: user.phone,
        customerAddress: user.address || '',
        vendorUid: shop.uid,
        vendorShopName: shop.shopName,
        vendorAddress: shop.address,
        vendorPhone: shop.phone,
        items: [
          {
            jarType: selectedJar,
            quantity: quantity,
            pricePerUnit: selectedJarInfo.price,
          },
        ],
        subtotal: subtotal,
        deliveryFee: deliveryFee,
        total: total,
        deliveryType: deliveryType,
        status: 'pending' as const,
        latitude: deliveryCoords.latitude,
        longitude: deliveryCoords.longitude,
      };

      // Only add optional fields if they have values
      if (user.pincode) {
        orderData.customerPincode = user.pincode;
      }
      if (deliveryType === 'schedule' && scheduledDate) {
        orderData.scheduledDate = scheduledDate;
      }
      if (deliveryType === 'schedule' && scheduledTime) {
        orderData.scheduledTime = scheduledTime;
      }

      console.log('📦 Creating order:', orderData);
      const { docId: orderDocId, orderId: orderOrderId } = await createOrderDocument(orderData);
      
      const vendorUpi = shop.upiId?.trim();
      if (vendorUpi) {
        await createPaymentDocument({
          orderId: orderDocId,
          orderOrderId: orderOrderId,
          customerUid: user.id,
          customerName: user.name,
          vendorUid: shop.uid,
          vendorShopName: shop.shopName,
          amount: total,
          status: 'INITIATED',
        });
        const pa = encodeURIComponent(vendorUpi);
        const pn = encodeURIComponent((shop.shopName || shop.ownerName || 'Vendor').replace(/[^a-zA-Z0-9\s]/g, ''));
        const am = total.toFixed(2);
        const upiLink = `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR`;
        toast({
          title: 'Redirecting to UPI',
          description: 'Complete payment in your UPI app. Return here and click "I Have Paid" to confirm.',
        });
        setTimeout(() => {
          window.location.href = upiLink;
        }, 800);
        navigate(`/customer/tracking/${orderDocId}`);
      } else {
        toast({
          title: 'Order placed',
          description: `Your order of ${quantity}x ${selectedJarInfo.name} has been confirmed. Vendor has not set up UPI — please pay on delivery.`,
        });
        navigate(`/customer/tracking/${orderDocId}`);
      }
    } catch (error: any) {
      console.error('❌ Error placing order:', error);
      toast({
        title: 'Order failed',
        description: error.message || 'Failed to place order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/customer/select-shop')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Change Shop
            </Button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('orderWater')}</h1>
          <p className="text-muted-foreground mt-1">
            Quick one-time order — for recurring delivery, use{' '}
            <button
              type="button"
              className="text-primary underline font-medium"
              onClick={() => navigate('/customer/select-shop?mode=subscription')}
            >
              Create Subscription
            </button>
          </p>
          
          {/* Shop Info */}
          <Card className="card-shadow mt-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">{shop.shopName}</p>
                  <p className="text-sm text-muted-foreground">{shop.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { num: 1, label: t('selectJarType') },
            { num: 2, label: t('selectQuantity') },
            { num: 3, label: t('deliveryType') },
          ].map((s, i) => (
            <div key={s.num} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap ${
                  step >= s.num
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-primary-foreground/20 flex items-center justify-center text-sm font-bold">
                  {step > s.num ? <Check className="h-4 w-4" /> : s.num}
                </span>
                <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
              </div>
              {i < 2 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Jar Type Selection */}
            {step >= 1 && (
              <Card className={`card-shadow ${step === 1 ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full water-gradient flex items-center justify-center text-primary-foreground font-bold text-sm">
                      1
                    </span>
                    {t('selectJarType')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {jarOptions.map((jar) => (
                      <button
                        key={jar.type}
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
                          <p className="text-sm text-muted-foreground">
                            Fresh purified water
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">₹{jar.price}</p>
                          <p className="text-xs text-muted-foreground">per unit</p>
                        </div>
                        {selectedJar === jar.type && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Quantity Selection */}
            {step >= 2 && (
              <Card className={`card-shadow animate-slide-up ${step === 2 ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full water-gradient flex items-center justify-center text-primary-foreground font-bold text-sm">
                      2
                    </span>
                    {t('selectQuantity')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-6">
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
                      <span className="text-5xl font-bold">{quantity}</span>
                      <p className="text-muted-foreground mt-1">{selectedJarInfo.name}</p>
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

            {/* Step 3: Delivery Type */}
            {step >= 3 && (
              <Card className={`card-shadow animate-slide-up ${step === 3 ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full water-gradient flex items-center justify-center text-primary-foreground font-bold text-sm">
                      3
                    </span>
                    {t('deliveryType')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    {deliveryOptions.map((option) => (
                      <button
                        key={option.type}
                        onClick={() => setDeliveryType(option.type)}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                          deliveryType === option.type
                            ? 'border-primary bg-accent'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className={`p-3 rounded-xl ${
                          deliveryType === option.type ? 'water-gradient' : 'bg-muted'
                        }`}>
                          <option.icon className={`h-5 w-5 ${
                            deliveryType === option.type ? 'text-primary-foreground' : 'text-muted-foreground'
                          }`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-semibold">{option.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                        {option.type === 'today' && (
                          <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning">
                            +₹20
                          </span>
                        )}
                        {deliveryType === option.type && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Schedule Date/Time Inputs */}
                  {deliveryType === 'schedule' && (
                    <div className="mt-4 p-4 rounded-lg bg-accent/50 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="scheduledDate">Select Date</Label>
                        <Input
                          id="scheduledDate"
                          type="date"
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="scheduledTime">Select Time</Label>
                        <Input
                          id="scheduledTime"
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-4 p-4 rounded-xl border bg-muted/40 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold">Delivery location</p>
                        <p className="text-xs text-muted-foreground">
                          {coords
                            ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                            : 'Waiting for confirmation...'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUseCurrentLocation}
                        disabled={locating}
                        className="gap-2"
                      >
                        {locating ? 'Locating...' : 'Use my location'}
                      </Button>
                    </div>
                    {locationError && (
                      <p className="text-xs text-destructive">{locationError}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Use &quot;Use my location&quot; so the delivery person sees your exact spot on the map. We store your device coordinates for accurate delivery.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Price Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="card-shadow sticky top-24">
              <CardHeader>
                <CardTitle>{t('priceBreakdown')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {selectedJarInfo.name} × {quantity}
                    </span>
                    <span className="font-medium">₹{subtotal}</span>
                  </div>
                  {deliveryType === 'today' && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Express Delivery</span>
                      <span className="font-medium">₹{deliveryFee}</span>
                    </div>
                  )}
                  {deliveryType !== 'today' && (
                    <div className="flex justify-between text-success">
                      <span>Free Delivery</span>
                      <span>₹0</span>
                    </div>
                  )}
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>{t('total')}</span>
                    <span className="text-primary">₹{total}</span>
                  </div>
                </div>

                <Button
                  onClick={handleProceed}
                  className="w-full water-gradient text-primary-foreground font-semibold"
                  size="lg"
                  disabled={placingOrder}
                >
                  {placingOrder ? 'Placing Order...' : step < 3 ? 'Continue' : t('proceed')}
                  {!placingOrder && <ChevronRight className="h-4 w-4 ml-2" />}
                </Button>

                {step > 1 && (
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => setStep(step - 1)}
                  >
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
