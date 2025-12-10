'use client'

import React from 'react'
import { BillingStatementContent, type BillingStatementProps } from './BillingStatementContent'

export const BillingStatement: React.FC<BillingStatementProps> = (props) => (
  <BillingStatementContent {...props} enableLogoFallback />
)
