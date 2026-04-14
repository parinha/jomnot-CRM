export const dynamic = 'force-dynamic';

import SettingsView from '@/src/features/settings/components/SettingsView';
import {
  getCompanyProfile,
  getPaymentInfo,
  getScopeOfWork,
} from '@/src/features/settings/api/getSettings';

export default async function SettingsPage() {
  const [companyProfile, paymentInfo, scopeOfWork] = await Promise.all([
    getCompanyProfile(),
    getPaymentInfo(),
    getScopeOfWork(),
  ]);
  return (
    <SettingsView
      companyProfile={companyProfile}
      paymentInfo={paymentInfo}
      scopeOfWork={scopeOfWork}
    />
  );
}
