'use client';


import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';


export default function PlansPage() {
 const { isSignedIn, isLoaded } = useUser();
 const router = useRouter();
 const [loading, setLoading] = useState<string | null>(null);


 const handleSubscribe = async (priceId: string) => {
   if (isLoaded && !isSignedIn) {
     router.push(`/sign-in?redirect_url=/plans`);
     return;
   }


   try {
     setLoading(priceId);


     const res = await fetch('/api/stripe/checkout', {
       method: 'POST',
       credentials: 'include',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ priceId }),
     });


     const data = await res.json();


     if (data.url) {
       window.location.href = data.url;
     } else {
       alert(data.error || 'Error creating checkout session');
     }
   } catch (err) {
     console.error(err);
     alert('Unexpected error');
   } finally {
     setLoading(null);
   }
 };


 if (!isLoaded) return null;


 return (
   <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-950 to-black text-white px-6 py-16">
     <h1 className="text-4xl font-extrabold mb-12 text-center bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
       Choose your plan
     </h1>


     <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-6xl w-full">
       {/* BASIC */}
       <div className="relative bg-gray-900 border border-gray-700/40 rounded-3xl p-8 text-center shadow-lg hover:shadow-gray-700/30 transition-all duration-300">
  <h2 className="text-2xl font-bold text-gray-200 mb-3">Basic</h2>
  <p className="text-4xl font-extrabold mb-2">
    €0
  </p>
  <p className="text-gray-400 text-sm mb-8">
    Enjoy one story per day and access weekly highlights.
  </p>

  {isSignedIn ? (
    <button
      disabled
      className="w-full py-3 rounded-xl bg-gray-800 font-semibold text-gray-400 cursor-default"
    >
      Current Plan
    </button>
  ) : (
    <button
      onClick={() => router.push('/sign-up')}
      className="w-full py-3 rounded-xl bg-gray-700 font-semibold hover:bg-gray-800 transition"
    >
      Join for Free
    </button>
  )}
</div>

       {/* PREMIUM MONTHLY */}
       <div className="relative bg-gray-900 border border-indigo-700/40 rounded-3xl p-8 text-center shadow-lg hover:shadow-indigo-700/30 transition-all duration-300">
         <h2 className="text-2xl font-bold text-indigo-300 mb-3">Premium Monthly</h2>
         <p className="text-4xl font-extrabold mb-2">
           €14.99<span className="text-lg font-medium">/mo</span>
         </p>
         <p className="text-gray-400 text-sm mb-8">
           Unlock all stories and enjoy personalized recommendations.
         </p>

         <button
           onClick={() => handleSubscribe('price_1SI5WW6ytrKVzptQW7CBTx2G')}
           disabled={loading === 'price_1SI5WW6ytrKVzptQW7CBTx2G'}
           className="w-full py-3 rounded-xl bg-indigo-600 font-semibold hover:bg-indigo-700 transition disabled:opacity-60"
         >
           {loading === 'price_1SI5WW6ytrKVzptQW7CBTx2G'
             ? 'Processing...'
             : 'Subscribe to Premium Monthly'}
         </button>
       </div>

       {/* PREMIUM YEARLY */}
       <div className="relative bg-gray-900 border border-indigo-500/40 rounded-3xl p-8 text-center shadow-lg hover:shadow-indigo-500/30 transition-all duration-300">
         <div className="absolute -top-4 right-4 bg-indigo-500 text-black text-xs font-bold px-3 py-1 rounded-full">
           Best Value
         </div>
         <h2 className="text-2xl font-bold text-indigo-200 mb-3">Premium Annual</h2>
         <p className="text-4xl font-extrabold mb-2">
           €149<span className="text-lg font-medium">/yr</span>
         </p>
         <p className="text-gray-400 text-sm mb-8">
           Get full access for a year and save two months.
         </p>

         <button
           onClick={() => handleSubscribe('price_1SVmJt6ytrKVzptQrinkGA6I')}
           disabled={loading === 'price_1SVmJt6ytrKVzptQrinkGA6I'}
           className="w-full py-3 rounded-xl bg-indigo-500 font-semibold hover:bg-indigo-600 transition disabled:opacity-60"
         >
           {loading === 'price_1SVmJt6ytrKVzptQrinkGA6I'
             ? 'Processing...'
             : 'Subscribe to Premium Annual'}
         </button>
       </div>
     </div>


     <p className="mt-10 text-gray-500 text-sm text-center">
       You can upgrade or cancel anytime. No hidden fees.
     </p>
   </div>
 );
}
