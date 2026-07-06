import { ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home,
  ShoppingCart,
  Package,
  History,
  User,
  LogOut,
  MapPin,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@shared/components/ui/button';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@shared/components/ui/sheet';

interface CustomerLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/customer', icon: Home, label: 'dashboard' },
  { path: '/customer/order', icon: ShoppingCart, label: 'orderWater' },
  { path: '/customer/subscriptions', icon: Package, label: 'subscriptions' },
  { path: '/customer/history', icon: History, label: 'orderHistory' },
  { path: '/customer/profile', icon: User, label: 'profile' },
];

export function CustomerLayout({ children }: CustomerLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Mobile Menu */}
          <div className="lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="mb-6">
                  <Logo />
                </div>
                <nav className="space-y-2">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        location.pathname === item.path
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{t(item.label)}</span>
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Logo */}
          <Link to="/customer" className="hidden lg:block">
            <Logo size="sm" />
          </Link>
          <Link to="/customer" className="lg:hidden">
            <Logo size="sm" showText={false} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{t(item.label)}</span>
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            {/* Address Selector */}
            <Button variant="ghost" size="sm" className="hidden sm:flex gap-2 max-w-[200px]">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate text-sm">
                {user?.city && user?.state
                  ? `${user.city}, ${user.state}`
                  : user?.address
                    ? user.address
                    : t('address')}
              </span>
            </Button>

            <LanguageSelector />

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="h-8 w-8 rounded-full water-gradient flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">
                      {user?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="font-medium">{user?.name}</p>
                  <p className="text-sm text-muted-foreground">+91 {user?.phone}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/customer/profile" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t('profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  {t('logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
