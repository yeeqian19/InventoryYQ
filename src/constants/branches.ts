// Master branch list — mirrors BRANCH_MASTER_LIST in the Next.js app
// (app/dashboard, app/inventory-branch, app/RM_Dashboard). Single source of truth
// for every branch picker/list in the mobile app.

export type Region = 'A' | 'B' | 'C' | 'HQ';
export type Branch = { code: string; name: string; region: Region };

export const BRANCHES: Branch[] = [
  // Region A
  { code: 'RBY', name: 'Rimbayu', region: 'A' },
  { code: 'KLG', name: 'Klang', region: 'A' },
  { code: 'SHA', name: 'Shah Alam', region: 'A' },
  { code: 'SA', name: 'Setia Alam', region: 'A' },
  { code: 'DA', name: 'Denai Alam', region: 'A' },
  { code: 'EGR', name: 'Eco Grandeur', region: 'A' },
  { code: 'ST', name: 'Subang Taipan', region: 'A' },
  { code: 'AC', name: 'Anggun City Rawang', region: 'A' },
  { code: 'SBY', name: 'Sungai Buloh', region: 'A' },
  // Region B
  { code: 'SLY', name: 'Selayang', region: 'B' },
  { code: 'DK', name: 'Danau Kota', region: 'B' },
  { code: 'KD', name: 'Kota Damansara', region: 'B' },
  { code: 'AMP', name: 'Ampang', region: 'B' },
  { code: 'SP', name: 'Sri Petaling', region: 'B' },
  { code: 'BTHO', name: 'Bandar Tun Hussein Onn', region: 'B' },
  { code: 'KTG', name: 'Kajang TTDI Groove', region: 'B' },
  { code: 'DSH', name: 'Desa Sri Hartamas', region: 'B' },
  { code: 'TSG', name: 'Taman Sri Gombak', region: 'B' },
  // Region C
  { code: 'PJY', name: 'Putrajaya', region: 'C' },
  { code: 'KW', name: 'Kota Warisan', region: 'C' },
  { code: 'BBB', name: 'Bandar Baru Bangi', region: 'C' },
  { code: 'CJY', name: 'Cyberjaya', region: 'C' },
  { code: 'BSP', name: 'Bandar Seri Putra', region: 'C' },
  { code: 'SNT', name: 'Senawang Taipan', region: 'C' },
  { code: 'SBN', name: 'Seremban', region: 'C' },
  { code: 'DP', name: 'Dataran Puchong Utama', region: 'C' },
  { code: 'ONL', name: 'Online / Others', region: 'C' },
  // HQ
  { code: 'HQ', name: 'Headquarters', region: 'HQ' },
];

// Sorted alphabetically by code — handy for dropdowns.
export const BRANCHES_SORTED: Branch[] = [...BRANCHES].sort((a, b) => a.code.localeCompare(b.code));

// Dropdown-ready options: "RBY - Rimbayu".
export const BRANCH_OPTIONS = BRANCHES_SORTED.map((b) => ({ label: `${b.code} - ${b.name}`, value: b.code }));
