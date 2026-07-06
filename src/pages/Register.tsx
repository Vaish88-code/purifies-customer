import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Phone, Lock, Check } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { useAuth, useTranslation, Language, UserRole } from '@shared/contexts/AuthContext';
import { useToast } from '@shared/hooks/use-toast';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [state, setState] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('customer');
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const t = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      toast({
        title: 'Name is required',
        description: 'Please enter your full name',
        variant: 'destructive',
      });
      return;
    }

    if (phone.length !== 10) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid 10-digit phone number',
        variant: 'destructive',
      });
      return;
    }

    // Vendor-specific validations
    if (selectedRole === 'vendor') {
      if (!shopName.trim()) {
        toast({
          title: 'Shop name is required',
          description: 'Please enter your shop name',
          variant: 'destructive',
        });
        return;
      }

      if (!address.trim()) {
        toast({
          title: 'Address is required',
          description: 'Please enter your shop address',
          variant: 'destructive',
        });
        return;
      }

      if (!state.trim()) {
        toast({
          title: 'State is required',
          description: 'Please enter your state',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // For non-vendors, address and state are also required
      if (!address.trim()) {
        toast({
          title: 'Address is required',
          description: 'Please enter your full delivery address',
          variant: 'destructive',
        });
        return;
      }

      if (!state.trim()) {
        toast({
          title: 'State is required',
          description: 'Please enter your state',
          variant: 'destructive',
        });
        return;
      }
    }

    const cleanedPincode = pincode.replace(/\D/g, '');
    if (cleanedPincode.length !== 6) {
      toast({
        title: 'Invalid pincode',
        description: 'Please enter a valid 6-digit pincode',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const result = await register(
        phone,
        password,
        selectedLanguage,
        fullName.trim(),
        selectedRole,
        address.trim(),
        cleanedPincode,
        state.trim(),
        selectedRole === 'vendor' ? shopName.trim() : undefined
      );
      setIsLoading(false);

      if (result.success) {
        toast({
          title: 'Registration successful!',
          description: result.error || 'Welcome to Purifies!',
          variant: result.error ? 'default' : 'default',
        });
        // Small delay to ensure user state is updated
        setTimeout(() => {
          const routes: Record<UserRole, string> = {
            customer: '/customer',
            vendor: '/vendor',
            delivery: '/delivery',
            admin: '/admin',
          };
          navigate(routes[selectedRole] || '/customer');
        }, 500);
      } else {
        toast({
          title: 'Registration failed',
          description: result.error || 'Please try again. Check your internet connection and Firebase configuration.',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setIsLoading(false);
      console.error('Registration error:', error);
      toast({
        title: 'Registration error',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const passwordMatch = password && confirmPassword && password === confirmPassword;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center">
        <Logo />
        <LanguageSelector />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md card-shadow animate-slide-up">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">{t('register')}</CardTitle>
            <CardDescription>
              Create your account to start ordering fresh water
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone')}</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm font-medium">+91</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="pl-20"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* Category / Role Selection */}
              <div className="space-y-2">
                <Label htmlFor="role">Category</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => {
                    setSelectedRole(value as UserRole);
                    // Clear shop name when changing from vendor
                    if (value !== 'vendor') {
                      setShopName('');
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="delivery">Delivery Partner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Shop Name - Only for Vendors */}
              {selectedRole === 'vendor' && (
                <div className="space-y-2">
                  <Label htmlFor="shopName">Shop Name *</Label>
                  <Input
                    id="shopName"
                    type="text"
                    placeholder="Enter your shop name"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                  />
                </div>
              )}

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address">
                  {selectedRole === 'vendor' ? 'Shop Address *' : 'Address *'}
                </Label>
                <Input
                  id="address"
                  type="text"
                  placeholder={selectedRole === 'vendor' ? 'Shop address' : 'House / Flat, Street, Area, City'}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              {/* State */}
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  type="text"
                  placeholder="Enter your state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>

              {/* Pincode */}
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode</Label>
                <Input
                  id="pincode"
                  type="tel"
                  placeholder="6-digit pincode"
                  value={pincode}
                  onChange={(e) =>
                    setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  maxLength={6}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {passwordMatch && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
                  )}
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-2">
                <Label htmlFor="language">{t('selectLanguage')}</Label>
                <Select
                  value={selectedLanguage}
                  onValueChange={(value) => setSelectedLanguage(value as Language)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                    <SelectItem value="mr">मराठी (Marathi)</SelectItem>
                    <SelectItem value="kn">ಕನ್ನಡ (Kannada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full water-gradient text-primary-foreground font-semibold"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : t('register')}
              </Button>

              {/* Login Link */}
              <p className="text-center text-sm text-muted-foreground">
                {t('existingUser')}{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  {t('login')}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}