'use client'

import { makeClientPage } from '../clientPage'

export default makeClientPage(() => import('../../src/pages/Login'))
