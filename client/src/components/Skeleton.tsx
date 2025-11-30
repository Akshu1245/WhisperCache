import { motion } from "framer-motion";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export function Skeleton({
  className = "",
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
}: SkeletonProps) {
  const baseClasses = "bg-zinc-800/50";
  
  const variantClasses = {
    text: "rounded h-4",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "shimmer",
    none: "",
  };

  const style = {
    width: width,
    height: height,
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
}

// Card Skeleton for dashboard components
export function CardSkeleton() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <Skeleton variant="circular" width={48} height={48} />
        <div className="flex-1">
          <Skeleton variant="text" width="60%" className="mb-2 h-5" />
          <Skeleton variant="text" width="40%" className="h-3" />
        </div>
      </div>
      <Skeleton variant="rectangular" height={100} className="mb-4" />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" width={80} height={32} />
        <Skeleton variant="rectangular" width={80} height={32} />
      </div>
    </div>
  );
}

// Stats Skeleton
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <Skeleton variant="text" width="50%" className="mb-2 h-3" />
          <Skeleton variant="text" width="70%" className="h-8" />
        </div>
      ))}
    </div>
  );
}

// Table Skeleton
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-zinc-800">
        <Skeleton variant="text" width="20%" className="h-4" />
        <Skeleton variant="text" width="30%" className="h-4" />
        <Skeleton variant="text" width="25%" className="h-4" />
        <Skeleton variant="text" width="15%" className="h-4" />
      </div>
      
      {/* Rows */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-zinc-800/50 last:border-0">
          <Skeleton variant="text" width="20%" className="h-4" />
          <Skeleton variant="text" width="30%" className="h-4" />
          <Skeleton variant="text" width="25%" className="h-4" />
          <Skeleton variant="text" width="15%" className="h-4" />
        </div>
      ))}
    </div>
  );
}

// Loading Spinner
export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      style={{ width: size, height: size }}
      className="border-2 border-teal-500/30 border-t-teal-500 rounded-full"
    />
  );
}

// Page Loading
export function PageLoading() {
  return (
    <div className="min-h-[400px] flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size={40} />
        <p className="text-zinc-400 text-sm mt-4">Loading...</p>
      </div>
    </div>
  );
}

export default Skeleton;
