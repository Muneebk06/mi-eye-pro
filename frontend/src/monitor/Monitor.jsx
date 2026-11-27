'use client';

import dynamic from 'next/dynamic';

// The demo timetable uses the local date and time on the user's device.
const Monitor = dynamic(() => import('./App'), { ssr: false });
export default Monitor;
