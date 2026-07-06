import {
  User,
  MapPin,
  Phone,
  Globe,
  CreditCard,
  HelpCircle,
  ChevronRight,
  Edit,
  Plus,
  LogOut,
  Trash2,
  Star,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { CustomerLayout } from '@/components/layouts/CustomerLayout';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { UpiPaymentMethod } from '@shared/lib/firebase/firestore';

// UPI provider config
const UPI_PROVIDERS = [
  {
    type: 'googlepay' as const,
    label: 'Google Pay',
    color: '#4285F4',
    bgColor: 'rgba(66, 133, 244, 0.1)',
    borderColor: 'rgba(66, 133, 244, 0.3)',
    icon: '₹',
    suffix: '@okicici',
    placeholder: 'yourname@okicici',
  },
  {
    type: 'phonepe' as const,
    label: 'PhonePe',
    color: '#5F259F',
    bgColor: 'rgba(95, 37, 159, 0.1)',
    borderColor: 'rgba(95, 37, 159, 0.3)',
    icon: '₹',
    suffix: '@ybl',
    placeholder: 'yourname@ybl',
  },
  {
    type: 'paytm' as const,
    label: 'Paytm',
    color: '#00BAF2',
    bgColor: 'rgba(0, 186, 242, 0.1)',
    borderColor: 'rgba(0, 186, 242, 0.3)',
    icon: '₹',
    suffix: '@paytm',
    placeholder: 'yourname@paytm',
  },
  {
    type: 'upi' as const,
    label: 'Other UPI',
    color: '#097969',
    bgColor: 'rgba(9, 121, 105, 0.1)',
    borderColor: 'rgba(9, 121, 105, 0.3)',
    icon: '₹',
    suffix: '',
    placeholder: 'yourname@bank',
  },
];

function getProviderConfig(type: string) {
  return UPI_PROVIDERS.find((p) => p.type === type) || UPI_PROVIDERS[3];
}

export default function CustomerProfile() {
  const { user, language, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const t = useTranslation();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [addressInput, setAddressInput] = useState(user?.address || '');
  const [pincodeInput, setPincodeInput] = useState(user?.pincode || '');
  const [cityInput, setCityInput] = useState(user?.city || '');
  const [stateInput, setStateInput] = useState(user?.state || '');
  const [saving, setSaving] = useState(false);

  // Payment method state
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<typeof UPI_PROVIDERS[0] | null>(null);
  const [upiIdInput, setUpiIdInput] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const paymentMethods: UpiPaymentMethod[] = user?.paymentMethods || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const baseAddress = addressInput.trim();
      const cityPart = cityInput.trim();
      const fullAddress =
        cityPart && baseAddress && !baseAddress.toLowerCase().includes(cityPart.toLowerCase())
          ? `${baseAddress}, ${cityPart}`
          : baseAddress || user.address;
      await updateProfile({
        name: nameInput.trim() || user.name,
        address: fullAddress || undefined,
        pincode: pincodeInput.trim() || undefined,
        city: cityInput.trim() || undefined,
        state: stateInput.trim() || undefined,
      });
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPaymentMethod = async () => {
    if (!user || !selectedProvider || !upiIdInput.trim()) return;
    try {
      setSavingPayment(true);
      const newMethod: UpiPaymentMethod = {
        id: `${selectedProvider.type}_${Date.now()}`,
        type: selectedProvider.type,
        upiId: upiIdInput.trim(),
        label: selectedProvider.label,
        isDefault: paymentMethods.length === 0,
      };
      const updatedMethods = [...paymentMethods, newMethod];
      await updateProfile({ paymentMethods: updatedMethods });
      setUpiIdInput('');
      setSelectedProvider(null);
      setShowAddPayment(false);
    } catch (error) {
      console.error('Failed to add payment method:', error);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleRemovePaymentMethod = async (id: string) => {
    if (!user) return;
    try {
      setSavingPayment(true);
      let updatedMethods = paymentMethods.filter((m) => m.id !== id);
      // If we removed the default, make the first one default
      if (updatedMethods.length > 0 && !updatedMethods.some((m) => m.isDefault)) {
        updatedMethods = updatedMethods.map((m, i) => ({ ...m, isDefault: i === 0 }));
      }
      await updateProfile({ paymentMethods: updatedMethods });
    } catch (error) {
      console.error('Failed to remove payment method:', error);
    } finally {
      setSavingPayment(false);
    }
  };

  const handleSetDefaultPayment = async (id: string) => {
    if (!user) return;
    try {
      setSavingPayment(true);
      const updatedMethods = paymentMethods.map((m) => ({
        ...m,
        isDefault: m.id === id,
      }));
      await updateProfile({ paymentMethods: updatedMethods });
    } catch (error) {
      console.error('Failed to set default payment:', error);
    } finally {
      setSavingPayment(false);
    }
  };

  const languageLabels = {
    en: 'English',
    hi: 'हिंदी (Hindi)',
    mr: 'मराठी (Marathi)',
  };

  return (
    <CustomerLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">{t('profile')}</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings
          </p>
        </div>

        {/* Profile Card + Basic Info Edit */}
        <Card className="card-shadow">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full water-gradient flex items-center justify-center text-2xl font-bold text-primary-foreground">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Phone: +91 {user?.phone}
                    </p>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-bold">{user?.name || 'User'}</h2>
                    <p className="text-muted-foreground">+91 {user?.phone}</p>
                  </>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing((prev) => !prev);
                  setNameInput(user?.name || '');
                  setAddressInput(user?.address || '');
                  setPincodeInput(user?.pincode || '');
                  setStateInput(user?.state || '');
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>

            {/* Address fields when editing */}
            {editing && (
              <div className="grid gap-3">
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    placeholder="House / Flat, Street, Area"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      placeholder="e.g. Kolhapur"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={stateInput}
                      onChange={(e) => setStateInput(e.target.value)}
                      placeholder="e.g. Maharashtra"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pincode">Pincode</Label>
                    <Input
                      id="pincode"
                      value={pincodeInput}
                      onChange={(e) => setPincodeInput(e.target.value)}
                      placeholder="e.g. 400001"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved Address (read-only from profile) */}
        <Card className="card-shadow">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {t('address')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {user?.address ? (
              <>
                <p className="text-sm text-muted-foreground">{user.address}</p>
                <p className="text-sm text-muted-foreground">
                  {user.city && <>{user.city}</>}
                  {user.state && (
                    <>
                      {user.city ? ', ' : ''}
                      {user.state}
                    </>
                  )}
                  {user.pincode && (
                    <>
                      {(user.city || user.state) ? ', ' : ''}
                      {user.pincode}
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No address saved yet. Click the edit icon above to add your address.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Language Preference */}
        <Card className="card-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Language Preference</p>
                  <p className="text-sm text-muted-foreground">{languageLabels[language]}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Payment Methods - UPI */}
        <Card className="card-shadow">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Payment Methods
            </CardTitle>
            {!showAddPayment && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowAddPayment(true)}
              >
                <Plus className="h-4 w-4" />
                Add UPI
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Payment Method Flow */}
            {showAddPayment && (
              <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-4 animate-slide-up">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">Add UPI Payment Method</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => {
                      setShowAddPayment(false);
                      setSelectedProvider(null);
                      setUpiIdInput('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Provider Selection */}
                {!selectedProvider ? (
                  <div className="grid grid-cols-2 gap-3">
                    {UPI_PROVIDERS.map((provider) => (
                      <button
                        key={provider.type}
                        onClick={() => setSelectedProvider(provider)}
                        className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          backgroundColor: provider.bgColor,
                          borderColor: provider.borderColor,
                        }}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
                          style={{ backgroundColor: provider.color }}
                        >
                          {provider.icon}
                        </div>
                        <span className="font-medium text-sm text-left">{provider.label}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  /* UPI ID Input */
                  <div className="space-y-3">
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg"
                      style={{
                        backgroundColor: selectedProvider.bgColor,
                        border: `1px solid ${selectedProvider.borderColor}`,
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ backgroundColor: selectedProvider.color }}
                      >
                        {selectedProvider.icon}
                      </div>
                      <span className="font-medium text-sm">{selectedProvider.label}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-xs h-7"
                        onClick={() => {
                          setSelectedProvider(null);
                          setUpiIdInput('');
                        }}
                      >
                        Change
                      </Button>
                    </div>

                    <div>
                      <Label htmlFor="upiId" className="text-sm">
                        UPI ID
                      </Label>
                      <Input
                        id="upiId"
                        value={upiIdInput}
                        onChange={(e) => setUpiIdInput(e.target.value)}
                        placeholder={selectedProvider.placeholder}
                        className="mt-1"
                      />
                      {selectedProvider.suffix && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Common format: yourname{selectedProvider.suffix}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowAddPayment(false);
                          setSelectedProvider(null);
                          setUpiIdInput('');
                        }}
                        disabled={savingPayment}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddPaymentMethod}
                        disabled={savingPayment || !upiIdInput.trim()}
                        className="gap-1.5"
                      >
                        {savingPayment ? 'Saving...' : 'Add Payment Method'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saved Payment Methods List */}
            {paymentMethods.length > 0 ? (
              <div className="space-y-3">
                {paymentMethods.map((method) => {
                  const config = getProviderConfig(method.type);
                  return (
                    <div
                      key={method.id}
                      className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:shadow-sm"
                      style={{
                        backgroundColor: method.isDefault ? config.bgColor : undefined,
                        borderColor: method.isDefault ? config.borderColor : undefined,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
                        style={{ backgroundColor: config.color }}
                      >
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{method.label}</p>
                          {method.isDefault && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {method.upiId}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!method.isDefault && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => handleSetDefaultPayment(method.id)}
                            disabled={savingPayment}
                            title="Set as default"
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemovePaymentMethod(method.id)}
                          disabled={savingPayment}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              !showAddPayment && (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                    <CreditCard className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No payment methods added</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add your UPI ID for Google Pay, PhonePe, Paytm or other UPI apps
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowAddPayment(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add Payment Method
                  </Button>
                </div>
              )
            )}
          </CardContent>
        </Card>

        {/* Help & Support */}
        <Card className="card-shadow cursor-pointer hover:bg-muted/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Help & Support</p>
                  <p className="text-sm text-muted-foreground">Get help or file a complaint</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {t('logout')}
        </Button>
      </div>
    </CustomerLayout>
  );
}
