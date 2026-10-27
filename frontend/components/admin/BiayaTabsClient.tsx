'use client'

import { useState } from 'react'
import { DollarSign, Tag } from 'lucide-react'
import { PageHeader } from '@/components/layout/Topbar'
import ExpensesClient, { Expense } from '@/components/admin/Expenses'
import ExpenseCategoriesClient, { ExpenseCategory } from '@/components/admin/ExpenseCategories'

type Tab = 'pengeluaran' | 'kategori'

export default function BiayaTabsClient({
  initialExpenses,
  initialCategories,
}: {
  initialExpenses: Expense[]
  initialCategories: ExpenseCategory[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('pengeluaran')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'pengeluaran', label: 'Pengeluaran', icon: <DollarSign size={15} /> },
    { key: 'kategori', label: 'Kelola Kategori', icon: <Tag size={15} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Biaya Operasional"
        subtitle="Kelola pengeluaran toko, pantau pencatatan kasir, dan rekonsiliasi kas laci shift"
      />

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        borderBottom: '1px solid var(--line)',
        paddingBottom: 0
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--acc)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--acc)' : 'var(--mute)',
              transition: 'all 0.15s ease',
              marginBottom: -1,
              borderRadius: '8px 8px 0 0'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'pengeluaran' && (
        <ExpensesClient
          initialExpenses={initialExpenses}
          categories={initialCategories}
          hideHeader
        />
      )}

      {activeTab === 'kategori' && (
        <ExpenseCategoriesClient initialCategories={initialCategories} />
      )}
    </div>
  )
}
