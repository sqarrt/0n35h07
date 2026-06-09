import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VersionChip } from '../../src/components/VersionChip'

describe('VersionChip', () => {
  it('показывает версию из __APP_VERSION__ с префиксом v', () => {
    render(<VersionChip />)
    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeTruthy()
  })
})
