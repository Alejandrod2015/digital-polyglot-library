'use client';


import Link from 'next/link';
import { motion } from 'framer-motion';


export default function SuccessPage() {
 return (
   <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 via-gray-950 to-black text-white px-4">
     <motion.div
       initial={{ opacity: 0, y: -20 }}
       animate={{ opacity: 1, y: 0 }}
       transition={{ duration: 0.6 }}
       className="text-center"
     >
       <motion.div
         initial={{ scale: 0 }}
         animate={{ scale: 1 }}
         transition={{ type: 'spring', stiffness: 200, damping: 15 }}
         className="text-6xl mb-4"
       >
         ✅
       </motion.div>


       <h1 className="text-4xl font-extrabold mb-2 bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">
         Payment successful!
       </h1>


       <p className="text-gray-400 max-w-md mx-auto mb-10">
         Your subscription is now active. You can close this page or return to start exploring all stories.
       </p>


       <Link
         href="/"
         className="inline-block px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 font-semibold transition shadow-lg"
       >
         Go back to Digital Polyglot
       </Link>
     </motion.div>


     <motion.div
       initial={{ opacity: 0 }}
       animate={{ opacity: 0.4 }}
       transition={{ delay: 1.2 }}
       className="absolute bottom-6 text-xs text-gray-600"
     >
       Thank you for supporting language learning ❤️
     </motion.div>
   </div>
 );
}
