import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import qrcodegenModule from '@/lib/qrcodegen';

// The vendored encoder is @ts-nocheck (mirror of upstream), so its default export is
// untyped — alias to any for ergonomic access to QrCode/QrSegment/Ecc.
const qrcodegen = qrcodegenModule as any;

// Renders a QR code byte-identical to the web's <QRCodeSVG> (qrcode.react). It uses the
// SAME vendored Nayuki encoder and the SAME parameters qrcode.react uses internally
// (makeSegments → encodeSegments with ecl, minVersion 1, maxVersion 40, auto mask,
// boostEcl true), then the SAME path generator — so the on-screen pattern matches the web.

const ERROR_LEVEL: Record<string, unknown> = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH,
};

// Verbatim copy of qrcode.react's generatePath so the SVG <path> data is identical.
function generatePath(modules: boolean[][], margin = 0): string {
  const ops: string[] = [];
  modules.forEach((row, y) => {
    let start: number | null = null;
    row.forEach((cell, x) => {
      if (!cell && start !== null) {
        ops.push(`M${start + margin} ${y + margin}h${x - start}v1H${start + margin}z`);
        start = null;
        return;
      }
      if (x === row.length - 1) {
        if (!cell) return;
        if (start === null) {
          ops.push(`M${x + margin},${y + margin} h1v1H${x + margin}z`);
        } else {
          ops.push(`M${start + margin},${y + margin} h${x + 1 - start}v1H${start + margin}z`);
        }
        return;
      }
      if (cell && start === null) start = x;
    });
  });
  return ops.join('');
}

type Props = {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  color?: string;
  backgroundColor?: string;
};

function QrCode({ value, size = 44, level = 'L', color = '#000000', backgroundColor = '#FFFFFF' }: Props) {
  const { path, numCells } = useMemo(() => {
    const segs = qrcodegen.QrSegment.makeSegments(value);
    // Same call qrcode.react makes: encodeSegments(segs, ecl, minVersion=1, maxVersion=40, mask=-1, boostEcl=true)
    const qr = qrcodegen.QrCode.encodeSegments(segs, ERROR_LEVEL[level], 1, 40, -1, true);
    const cells: boolean[][] = qr.getModules();
    return { path: generatePath(cells, 0), numCells: cells.length };
  }, [value, level]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${numCells} ${numCells}`}>
      <Path fill={backgroundColor} d={`M0,0 h${numCells}v${numCells}H0z`} />
      <Path fill={color} d={path} />
    </Svg>
  );
}

export default memo(QrCode);
