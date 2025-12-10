import React from 'react'
import { BillingStatementContent, type BillingStatementProps } from './BillingStatementContent'

export const BillingStatementServer: React.FC<BillingStatementProps> = (props) => (
  <BillingStatementContent {...props} />
)
