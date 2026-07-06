import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Droplets,
  Calendar,
  ChevronRight,
  Loader2,
  Package,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation, useFormatCurrency } from '@shared/contexts/AuthContext';
import { subscribeToOrdersByCustomer } from '@shared/lib/firebase/firestore';
import type { Order } from '@shared/lib/firebase/firestore';
import { getOrderDisplayStatus, getStatusBadgeStyle, isOrderTrackable } from '@shared/utils/orderStatus';

// Safely get order date from Firestore (handles Timestamp, plain object, or Date)
function getOrderDate(order: Order): Date | null {
  const ca = (order.createdAt as any);
  if (!ca) return null;
  if (typeof ca?.toDate === 'function') return ca.toDate();
  if (typeof ca?.toMillis === 'function') return new Date(ca.toMillis());
  if (ca?.seconds != null) return new Date(ca.seconds * 1000);
  if (ca instanceof Date) return ca;
  return null;
}

export default function OrderHistory() {
  const { user } = useAuth();
  const t = useTranslation();
  const formatCurrency = useFormatCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToOrdersByCustomer(
      user.id,
      (customerOrders) => {
        setOrders(customerOrders);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [user?.id]);

  const formatOrderItems = (order: Order): string => {
    return (order.items || []).map(item => {
      const jarName = item.jarType === '20L' ? '20L Jar' : item.jarType === '10L' ? '10L Jar' : 'Bottles';
      return `${item.quantity}x ${jarName}`;
    }).join(', ');
  };

  // Status label for display
  const getStatusLabel = (order: Order): string => {
    const displayStatus = getOrderDisplayStatus(order);
    if (displayStatus === 'assigned_for_delivery') return t('assignedForDelivery');
    if (displayStatus === 'out_for_delivery') return t('outForDelivery');
    if (displayStatus === 'delivered') return t('delivered');
    if (displayStatus === 'pending') return t('pending');
    if (displayStatus === 'rejected' || displayStatus === 'cancelled') return t('cancelled');
    return order.status.replace('_', ' ');
  };

  const filteredOrders = orders;

  // Group orders by month and year
  const ordersByMonthYear = useMemo(() => {
    const groups: Record<string, Order[]> = {};
    filteredOrders.forEach(order => {
      const d = getOrderDate(order);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    });
    // Sort groups by date descending (newest first)
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredOrders]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Stats from filtered/displayed data
  const totalOrders = filteredOrders.length;
  const thisMonth = filteredOrders.filter(o => {
    const created = getOrderDate(o);
    if (!created) return false;
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  const totalSpent = filteredOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <CustomerLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('orderHistory')}</h1>
            <p className="text-muted-foreground mt-1">
              View all your orders, grouped by month and year
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalOrders}</p>
              <p className="text-xs text-muted-foreground">Total Orders</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-secondary">{thisMonth}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{formatCurrency(totalSpent)}</p>
              <p className="text-xs text-muted-foreground">Total Spent</p>
            </CardContent>
          </Card>
        </div>

        {/* Orders List - Grouped by Month & Year */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              All Orders
              <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-primary/20 text-primary ml-1">
                Live
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="font-medium text-muted-foreground">No orders yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Place your first order to get started
                </p>
                <Link to="/customer/select-shop">
                  <Button className="mt-4">{t('orderWater')}</Button>
                </Link>
              </div>
            ) : (
              ordersByMonthYear.map(([key, groupOrders]) => {
                const [year, month] = key.split('-');
                const monthName = monthNames[parseInt(month, 10)];
                const sectionLabel = `${monthName} ${year}`;
                return (
                  <div key={key} className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                      {sectionLabel}
                    </h3>
                    <div className="space-y-3">
                      {groupOrders.map((order) => {
                        const displayStatus = getOrderDisplayStatus(order);
                        const statusLabel = getStatusLabel(order);
                        const statusStyle = getStatusBadgeStyle(displayStatus);
                        return (
                          <Link
                            key={order.id}
                            to={isOrderTrackable(order) ? `/customer/tracking/${order.id}` : '#'}
                            className={`flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors ${
                              !isOrderTrackable(order) ? 'cursor-default' : 'cursor-pointer group'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                <Droplets className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold">{formatOrderItems(order)}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{getOrderDate(order)?.toLocaleDateString() ?? '-'}</span>
                                  <span>•</span>
                                  <span>{order.vendorShopName}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{order.orderId}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-bold text-lg">{formatCurrency(order.total)}</p>
                                <span className={`text-xs px-2 py-1 rounded-full border ${statusStyle}`}>
                                  {statusLabel}
                                </span>
                              </div>
                              {isOrderTrackable(order) && (
                                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </CustomerLayout>
  );
}
