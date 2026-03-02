"use client"

import { SipSimulator } from "@/modules/insights/components/sip-simulator"
import { PageHeader } from "@/components/shared/page-header"

export default function SipSimulatorPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="SIP Simulator" description="Simulate systematic investment plan returns" />
      <SipSimulator />
    </div>
  )
}
