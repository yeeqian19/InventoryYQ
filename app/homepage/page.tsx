import Link from 'next/link';

export default function InventoryHub() {
  return (
    <div className="flex h-screen w-full bg-[#f4f7f6] font-sans overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <div className="w-64 bg-[#7cb342] flex flex-col text-white py-6 shrink-0 justify-between">
        <div>
          <h2 className="text-2xl font-bold px-6 mb-8">My Inventory HQ</h2>
          <nav className="flex flex-col gap-2">
            <Link href="/Inventory-hub" className="px-6 py-3 bg-white/20 font-bold block border-l-4 border-white">
              Dashboard
            </Link>
            <Link href="/student-manager" className="px-6 py-3 hover:bg-white/10 transition-colors font-medium block">
              Student Manager
            </Link>
            <Link href="/scan-approve" className="px-6 py-3 hover:bg-white/10 transition-colors font-medium block">
              Scan & Approve
            </Link>
          </nav>
        </div>
        <Link href="/" className="mt-auto border-t border-white/20 pt-6 px-6 hover:underline flex items-center gap-2 font-medium">
          ← Back to Main Menu
        </Link>
      </div>

      {/* RIGHT CONTENT AREA (The Circles) */}
      <div className="flex-1 p-8 sm:p-12 overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-sm p-10 border border-gray-100 flex flex-col min-h-full">
          <h1 className="text-4xl font-extrabold text-[#1a2b3c] mb-12 border-b border-gray-100 pb-6">
            Distribution Progress
          </h1>

          {/* 3 Circles Container */}
          <div className="flex flex-wrap justify-center gap-12 sm:gap-20 mt-8">
            
            {/* Prep Circle */}
            <div className="w-56 h-56 rounded-full border-[12px] border-gray-50 shadow-sm flex flex-col items-center justify-center bg-white transition-transform hover:scale-105">
              <span className="text-gray-400 font-bold tracking-widest uppercase mb-1 text-sm">Prep</span>
              <span className="text-6xl text-[#7cb342] font-black">120</span>
            </div>

            {/* Pickup Circle */}
            <div className="w-56 h-56 rounded-full border-[12px] border-gray-50 shadow-sm flex flex-col items-center justify-center bg-white transition-transform hover:scale-105">
              <span className="text-gray-400 font-bold tracking-widest uppercase mb-1 text-sm">Pickup</span>
              <span className="text-6xl text-[#4a8cbf] font-black">45</span>
            </div>

            {/* Receive Circle */}
            <div className="w-56 h-56 rounded-full border-[12px] border-gray-50 shadow-sm flex flex-col items-center justify-center bg-white transition-transform hover:scale-105">
              <span className="text-gray-400 font-bold tracking-widest uppercase mb-1 text-sm">Receive</span>
              <span className="text-6xl text-[#605ca8] font-black">88</span>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}