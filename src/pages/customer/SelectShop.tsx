import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store, MapPin, Check, ArrowRight, Image as ImageIcon, Clock } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent } from '@shared/components/ui/card';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { getAllVendors, subscribeToVendors } from '@shared/lib/firebase/firestore';
import { Vendor } from '@shared/lib/firebase/firestore';
import { useToast } from '@shared/hooks/use-toast';

export type ShopProximity = 'near' | 'same_city' | 'same_state';

export interface ShopWithProximity extends Vendor {
  proximity: ShopProximity;
  deliveryMinMinutes: number;
  deliveryMaxMinutes: number;
}

function getShopProximity(
  shop: Vendor,
  userPincode?: string,
  userState?: string
): { proximity: ShopProximity; minMin: number; maxMin: number } {
  const shopPincode = String(shop.pincode || '').trim();
  const shopState = String(shop.state || '').trim();
  const pin = String(userPincode || '').trim();
  const state = String(userState || '').trim();

  if (pin && shopPincode && shopPincode === pin) {
    return { proximity: 'near', minMin: 15, maxMin: 30 };
  }
  if (pin && shopPincode && pin.length >= 3 && shopPincode.slice(0, 3) === pin.slice(0, 3)) {
    return { proximity: 'same_city', minMin: 25, maxMin: 45 };
  }
  if (state && shopState && shopState.toLowerCase() === state.toLowerCase()) {
    return { proximity: 'same_state', minMin: 45, maxMin: 90 };
  }
  return { proximity: 'same_state', minMin: 45, maxMin: 90 };
}

export default function SelectShop() {
  const { user } = useAuth();
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isSubscriptionMode = searchParams.get('mode') === 'subscription';
  const { toast } = useToast();
  const [shops, setShops] = useState<Vendor[]>([]);
  const [filteredShops, setFilteredShops] = useState<ShopWithProximity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<Vendor | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const filterAndEnrichShops = useCallback((vendors: Vendor[]): ShopWithProximity[] => {
    const approved = vendors.filter(v => v.status === 'approved');
    const userPin = user?.pincode;
    const userState = user?.state;
    if (!userPin && !userState) {
      return approved.map(v => {
        const { proximity, minMin, maxMin } = getShopProximity(v, userPin, userState);
        return { ...v, proximity, deliveryMinMinutes: minMin, deliveryMaxMinutes: maxMin };
      });
    }
    const filtered: ShopWithProximity[] = [];
    const uPin = String(userPin || '').trim();
    const uState = String(userState || '').trim();
    for (const v of approved) {
      const pin = String(v.pincode || '').trim();
      const vState = String(v.state || '').trim();
      const samePincodeRegion = uPin && pin && pin.length >= 3 && pin.slice(0, 3) === uPin.slice(0, 3);
      const sameStateMatch = uState && vState && vState.toLowerCase() === uState.toLowerCase();
      const inSameCityOrState = samePincodeRegion || sameStateMatch;
      if (inSameCityOrState || (!uPin && !uState)) {
        const { proximity, minMin, maxMin } = getShopProximity(v, userPin, userState);
        filtered.push({ ...v, proximity, deliveryMinMinutes: minMin, deliveryMaxMinutes: maxMin });
      }
    }
    return filtered.sort((a, b) => {
      const order: Record<ShopProximity, number> = { near: 0, same_city: 1, same_state: 2 };
      return (order[a.proximity] ?? 2) - (order[b.proximity] ?? 2);
    });
  }, [user?.pincode, user?.state]);

  useEffect(() => {
    // Initial fetch
    const fetchShops = async () => {
      try {
        setLoading(true);
        const allVendors = await getAllVendors();
        // Filter only approved vendors
        const approvedVendors = allVendors.filter(v => v.status === 'approved');
        setShops(approvedVendors);
        setFilteredShops(filterAndEnrichShops(approvedVendors));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching shops:', error);
        toast({
          title: 'Error',
          description: 'Failed to load shops. Please try again.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    fetchShops();

    const unsubscribe = subscribeToVendors((vendors) => {
      setShops(vendors);
      setFilteredShops(filterAndEnrichShops(vendors));
    });

    return () => unsubscribe();
  }, [user?.pincode, user?.state, toast, filterAndEnrichShops]);

  const handleShopSelect = (shop: Vendor) => {
    setSelectedShop(shop);
  };

  const handleContinue = () => {
    if (selectedShop) {
      if (isSubscriptionMode) {
        navigate(`/customer/subscribe?shopId=${selectedShop.uid}`);
      } else {
        navigate(`/customer/order?shopId=${selectedShop.uid}`);
      }
    } else {
      toast({
        title: 'Please select a shop',
        description: 'You need to select a shop before continuing.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading shops...</p>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {isSubscriptionMode ? 'Select Shop for Subscription' : t('selectShop') || 'Select Shop'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isSubscriptionMode
              ? 'Choose a shop to request a weekly water jar subscription. Your request will be sent for approval — not as a quick order.'
              : t('selectShopDesc') || 'Shops in your city — near shops show faster delivery times'}
            {user?.pincode && (
              <span className="ml-2">
                ({t('pincode') || 'Pincode'}: {user.pincode})
              </span>
            )}
          </p>
        </div>

        {/* Address Info */}
        {user?.address && (
          <Card className="card-shadow">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Delivery Address</p>
                  <p className="text-sm text-muted-foreground">
                    {user.address}
                    {user.state && `, ${user.state}`}
                    {user.pincode && ` - ${user.pincode}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shops List */}
        {filteredShops.length === 0 ? (
          <Card className="card-shadow">
            <CardContent className="p-8 text-center">
              <Store className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {t('noShopsInCity') || 'No shops in your city yet.'}
              </p>
              {!user?.pincode && (
                <p className="text-sm text-muted-foreground mt-2">
                  {t('updatePincodeForShops') || 'Update your pincode in profile to see shops in your area.'}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredShops.map((shop) => (
              <Card
                key={shop.uid}
                className={`card-shadow cursor-pointer transition-all ${
                  selectedShop?.uid === shop.uid
                    ? 'ring-2 ring-primary border-primary'
                    : 'hover:border-primary/50'
                }`}
                onClick={() => handleShopSelect(shop)}
              >
                <CardContent className="p-6 relative">
                  <div className="flex items-start gap-4">
                    {/* Proximity badge + delivery time */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1 z-10">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          shop.proximity === 'near'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : shop.proximity === 'same_city'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {shop.proximity === 'near'
                          ? (t('nearYou') || 'Near you')
                          : shop.proximity === 'same_city'
                          ? (t('sameCity') || 'Same city')
                          : (t('sameState') || 'Same state')}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {shop.deliveryMinMinutes}-{shop.deliveryMaxMinutes} min
                      </span>
                    </div>
                    {/* Shop Image - Larger and more prominent */}
                    <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex-shrink-0">
                      {shop.shopImage && !imageErrors.has(shop.uid) ? (
                        <div className="relative w-full h-full">
                          <img
                            src={shop.shopImage}
                            alt={shop.shopName}
                            className="w-full h-full object-cover rounded-xl border-2 border-border shadow-md"
                            onError={() => {
                              // Mark this shop's image as failed
                              setImageErrors(prev => new Set(prev).add(shop.uid));
                            }}
                          />
                          {selectedShop?.uid === shop.uid && (
                            <div className="absolute -top-2 -right-2 p-2 rounded-full bg-primary border-3 border-background shadow-lg z-10">
                              <Check className="h-5 w-5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className={`w-full h-full rounded-xl border-2 border-border flex items-center justify-center shadow-md ${
                            selectedShop?.uid === shop.uid
                              ? 'water-gradient'
                              : 'bg-muted'
                          }`}>
                            {shop.shopImage && imageErrors.has(shop.uid) ? (
                              <ImageIcon className={`h-10 w-10 ${
                                selectedShop?.uid === shop.uid
                                  ? 'text-primary-foreground'
                                  : 'text-muted-foreground'
                              }`} />
                            ) : (
                              <Store className={`h-10 w-10 ${
                                selectedShop?.uid === shop.uid
                                  ? 'text-primary-foreground'
                                  : 'text-muted-foreground'
                              }`} />
                            )}
                          </div>
                          {selectedShop?.uid === shop.uid && (
                            <div className="absolute -top-2 -right-2 p-2 rounded-full bg-primary border-3 border-background shadow-lg z-10">
                              <Check className="h-5 w-5 text-primary-foreground" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-semibold text-lg">{shop.shopName}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Owner: {shop.ownerName}
                          </p>
                          <div className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                              <p>{shop.address}</p>
                              {shop.pincode && (
                                <p className="text-xs mt-0.5">Pincode: {shop.pincode}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Show prices if available */}
                      {shop.prices && (
                        <div className="mt-4 pt-4 border-t flex items-center gap-4 flex-wrap">
                          {shop.prices.jar20L && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">20L:</span>
                              <span className="font-semibold ml-1 text-primary">₹{shop.prices.jar20L}</span>
                            </div>
                          )}
                          {shop.prices.jar10L && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">10L:</span>
                              <span className="font-semibold ml-1 text-primary">₹{shop.prices.jar10L}</span>
                            </div>
                          )}
                          {shop.prices.bottles && (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Bottles:</span>
                              <span className="font-semibold ml-1 text-primary">₹{shop.prices.bottles}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Continue Button */}
        {selectedShop && (
          <div className="sticky bottom-0 bg-background pt-4 pb-6 border-t">
            <Card className="card-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Selected: {selectedShop.shopName}</p>
                    <p className="text-sm text-muted-foreground">{selectedShop.address}</p>
                  </div>
                  <Button
                    onClick={handleContinue}
                    className="water-gradient text-primary-foreground font-semibold gap-2"
                    size="lg"
                  >
                    {isSubscriptionMode ? 'Continue to subscription setup' : t('continueToOrder') || 'Continue to Order'}
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}

