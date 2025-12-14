'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CompactRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/appointments')
  }, [router])

  return null
}
