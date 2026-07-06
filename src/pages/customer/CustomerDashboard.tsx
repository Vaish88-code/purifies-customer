import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  Package,
  History,
  MapPin,
  Droplets,
  Clock,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { LocationPermissionModal } from '@/components/location/LocationPermissionModal';
import { updateUserLocationWithPermission } from '@shared/lib/firebase/firestore';
import type { PermissionOutcome } from '@/components/location/LocationPermissionModal';

// Mock data
const recentOrders = [
  { id: 'ORD001', date: '2024-01-15', items: '2x 20L Jars', status: 'Delivered', amount: 80 },
  { id: 'ORD002', date: '2024-01-12', items: '1x 20L Jar', status: 'Delivered', amount: 40 },
];

const subscription = {
  active: true,
  type: 'Daily',
  jars: '1x 20L Jar',
  nextDelivery: 'Tomorrow, 8:00 AM',
};

const stats = {
  totalOrders: 45,
  totalJars: 90,
  monthlySavings: 450,
};

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const SESSION_STORAGE_KEY_LOCATION_MODAL_SHOWN = 'purifies_location_modal_responded';

function hasRespondedToLocationModalThisSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY_LOCATION_MODAL_SHOWN) === '1';
  } catch {
    return false;
  }
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const t = useTranslation();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showDeniedMessage, setShowDeniedMessage] = useState(false);
  const hasCheckedPermission = useRef(false);

  // When customer dashboard loads: show permission modal (then hide only if permission already granted)
  useEffect(() => {
    if (user?.role !== 'customer' || !user?.id) return;

    if (!('geolocation' in navigator)) {
      setShowDeniedMessage(true);
      return;
    }

    if (hasRespondedToLocationModalThisSession()) return;
    if (hasCheckedPermission.current) return;

    hasCheckedPermission.current = true;

    // Show modal immediately so user always sees it; we'll hide if permission already granted
    setShowLocationModal(true);

    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          setShowLocationModal(false);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              updateUserLocationWithPermission(
                user.id,
                pos.coords.latitude,
                pos.coords.longitude,
                true
              ).catch(() => {});
            },
            () => {},
            GEOLOCATION_OPTIONS
          );
        } else if (result.state === 'denied') {
          setShowLocationModal(false);
          setShowDeniedMessage(true);
        }
        // if 'prompt', keep modal visible (already set above)
      }).catch(() => {
        // keep modal visible
      });
    }
  }, [user?.id, user?.role]);

  const handleModalClose = (outcome: PermissionOutcome) => {
    setShowLocationModal(false);
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY_LOCATION_MODAL_SHOWN, '1');
    } catch {
      // ignore
    }
    if (outcome === 'denied') {
      setShowDeniedMessage(true);
    }
  };

  return (
    <CustomerLayout>
      <div className="space-y-6">
        {/* Android-style location permission modal - appears automatically when permission is prompt */}
        <LocationPermissionModal
          visible={showLocationModal}
          userId={user?.id}
          onClose={handleModalClose}
        />

        {/* Warning when user denied or permission was denied */}
        {showDeniedMessage && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Location required for delivery tracking.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {t('welcome')}, {user?.name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-muted-foreground mt-1">
              Fresh water, delivered to your doorstep
            </p>
          </div>
          <Link to="/customer/select-shop">
            <Button size="lg" className="water-gradient text-primary-foreground font-semibold gap-2">
              <Droplets className="h-5 w-5" />
              {t('orderWater')}
            </Button>
          </Link>
        </div>

        {/* Active Subscription Card */}
        {subscription.active && (
          <Card className="card-shadow border-2 border-primary/20 bg-accent/30 animate-slide-up">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl water-gradient">
                    <Package className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Active Subscription</h3>
                    <p className="text-muted-foreground">{subscription.type} - {subscription.jars}</p>
                    <div className="flex items-center gap-2 mt-2 text-sm text-primary">
                      <Clock className="h-4 w-4" />
                      <span>Next: {subscription.nextDelivery}</span>
                    </div>
                  </div>
                </div>
                <Link to="/customer/subscriptions">
                  <Button variant="outline" className="gap-2">
                    Manage
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/customer/select-shop" className="group">
            <Card className="card-shadow hover:card-shadow-hover transition-all duration-300 h-full group-hover:-translate-y-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-primary/10 mb-4 group-hover:bg-primary/20 transition-colors">
                  <ShoppingCart className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg">{t('quickOrder')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Order water jars instantly
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/customer/subscriptions" className="group">
            <Card className="card-shadow hover:card-shadow-hover transition-all duration-300 h-full group-hover:-translate-y-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-secondary/10 mb-4 group-hover:bg-secondary/20 transition-colors">
                  <Package className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="font-semibold text-lg">{t('subscriptions')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your water subscription
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/customer/history" className="group">
            <Card className="card-shadow hover:card-shadow-hover transition-all duration-300 h-full group-hover:-translate-y-1">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-4 rounded-2xl bg-warning/10 mb-4 group-hover:bg-warning/20 transition-colors">
                  <History className="h-8 w-8 text-warning" />
                </div>
                <h3 className="font-semibold text-lg">{t('orderHistory')}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  View all past orders
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 animate-slide-up-delay-1">
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary">{stats.totalOrders}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Orders</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-secondary">{stats.totalJars}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Jars Delivered</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-success">₹{stats.monthlySavings}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Monthly Savings</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card className="card-shadow animate-slide-up-delay-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent Orders</CardTitle>
            <Link to="/customer/history">
              <Button variant="ghost" size="sm" className="gap-1">
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Droplets className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{order.items}</p>
                      <p className="text-sm text-muted-foreground">{order.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{order.amount}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-success/10 text-success">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card className="card-shadow animate-slide-up-delay-3">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-accent">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Delivery Address</h3>
                  <Button variant="ghost" size="sm">Change</Button>
                </div>
                {user?.address ? (
                  <p className="text-muted-foreground mt-1">
                    {user.address}
                    {user.state && <><br />{user.state}</>}
                    {user.pincode && <>, {user.pincode}</>}
                  </p>
                ) : (
                  <p className="text-muted-foreground mt-1">
                    No address registered. Please update your profile.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}
