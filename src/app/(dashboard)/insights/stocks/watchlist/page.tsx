"use client"

import { WatchlistTab } from "@/modules/insights/components/watchlist-tab"
import { PageHeader } from "@/components/shared/page-header"

export default function WatchlistPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Watchlist" description="Track prices for your saved stocks" />
      <WatchlistTab />
    </div>
  )
}
