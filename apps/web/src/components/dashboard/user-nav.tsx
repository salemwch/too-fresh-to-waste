'use client';

import { useTranslations } from 'next-intl';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@foodwaste/ui';
import { LogOut, User, Shield, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Link } from '@/i18n/routing';
import { resolveProfileImage } from '@/lib/media';

export function UserNav() {
  const { user, logout } = useAuth();
  const t = useTranslations('dashboard');

  if (!user) return null;

  const initials =
    `${user.firstName?.charAt(0) ?? ''}${user.lastName?.charAt(0) ?? ''}`.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100 transition-colors outline-none">
          <Avatar className="h-7 w-7 rounded-md flex-shrink-0">
            <AvatarImage
              src={resolveProfileImage(user.profileImage)}
              alt={`${user.firstName} ${user.lastName}`}
              className="rounded-md object-cover"
            />
            <AvatarFallback className="rounded-md bg-primary-100 text-primary-700 text-[10px] font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:block text-left">
            <p className="text-[11px] font-medium text-slate-900 leading-tight">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[9px] text-slate-500">{t('nav.merchant')}</p>
          </div>
          <ChevronDown className="h-3 w-3 text-slate-400 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/merchant/profile" className="flex items-center gap-2 cursor-pointer">
            <User className="h-4 w-4" />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/merchant/security" className="flex items-center gap-2 cursor-pointer">
            <Shield className="h-4 w-4" />
            {t('security')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
