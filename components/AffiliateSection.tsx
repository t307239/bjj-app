const AFF_CODE = "bjjapp";

const PRODUCTS = [
  {
    id: "bernardo-faria-half-guard",
    title: "Half Guard: A Complete System",
    instructor: "Bernardo Faria",
    price: "$97",
    img: "https://bjjfanatics.com/cdn/shop/products/HalfGuardCompleteSystem_large.jpg",
    url: `https://bjjfanatics.com/products/half-guard-a-complete-system-by-bernardo-faria?ref=${AFF_CODE}`,
  },
  {
    id: "john-danaher-leg-locks",
    title: "Leg Locks: Enter the System",
    instructor: "John Danaher",
    price: "$97",
    img: "https://bjjfanatics.com/cdn/shop/products/LegLocksEntertheSystem_large.jpg",
    url: `https://bjjfanatics.com/products/leg-locks-enter-the-system-by-john-danaher?ref=${AFF_CODE}`,
  },
  {
    id: "marcelo-garcia-advanced",
    title: "Advanced Butterfly Guard",
    instructor: "Marcelo Garcia",
    price: "$77",
    img: "https://bjjfanatics.com/cdn/shop/products/AdvancedButterflyGuard_large.jpg",
    url: `https://bjjfanatics.com/products/advanced-butterfly-guard-by-marcelo-garcia?ref=${AFF_CODE}`,
  },
];

export default function AffiliateSection() {
  return (
    <section className="mt-8 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-white">おすすめインストラクショナル</h2>
        <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">PR</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PRODUCTS.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="block bg-[#1a2744] rounded-xl p-4 hover:bg-[#1e3060] transition-colors border border-gray-700/50"
          >
            <div className="text-sm font-semibold text-white mb-1">{p.title}</div>
            <div className="text-xs text-gray-400 mb-2">{p.instructor}</div>
            <div className="text-red-400 font-bold text-sm">{p.price}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
