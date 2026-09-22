import { useMemo } from 'react';
import { Download, X } from 'lucide-react';
import { buildBom } from '../../core/bom/buildBom';
import { bomToCsv } from '../../core/bom/bomCsv';
import { downloadText } from '../../io/fileDownload';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

const safeFileName = (name: string): string => (name.trim() || 'project').replace(/[\\/:*?"<>|]/g, '_').slice(0, 60);

/**
 * 部品表。設計データからその場で集計するだけで、保存対象は増やさない。
 * 同じ素材寸法かつ同じ加工の部材だけをまとめる（形状ハッシュ一致）。
 */
export function BomPanel() {
  const open = useEditorStore((s) => s.bomOpen);
  const setOpen = useEditorStore((s) => s.setBomOpen);
  const project = useProjectStore((s) => s.project);
  const bom = useMemo(() => buildBom(project), [project]);

  if (!open) return null;

  return (
    <div className="overlay-panel" role="dialog" aria-label="部品表">
      <div className="overlay-head">
        <strong>部品表</strong>
        <span className="muted">
          {bom.totalParts} 部材 / {bom.rows.length} 種類 / 合計 {bom.totalAreaM2} m2
        </span>
        <button
          type="button"
          disabled={bom.rows.length === 0}
          onClick={() => downloadText(bomToCsv(bom, project.name), `${safeFileName(project.name)}_部品表.csv`)}
        >
          <Download size={15} aria-hidden />
          CSV 書き出し
        </button>
        <button type="button" className="icon-btn" title="閉じる" aria-label="閉じる" onClick={() => setOpen(false)}>
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="overlay-body">
        {bom.rows.length === 0 ? (
          <p className="muted">部材がありません。先に木材を生成してください。</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>材質</th>
                  <th className="num">長さ</th>
                  <th className="num">幅</th>
                  <th className="num">厚み</th>
                  <th className="num">数量</th>
                  <th>加工</th>
                  <th>名前</th>
                </tr>
              </thead>
              <tbody>
                {bom.rows.map((row, index) => (
                  <tr key={row.key}>
                    <td className="num">{index + 1}</td>
                    <td>{row.materialLabel}</td>
                    <td className="num">{row.lumber.length}</td>
                    <td className="num">{row.lumber.width}</td>
                    <td className="num">{row.lumber.thickness}</td>
                    <td className="num">{row.quantity}</td>
                    <td>
                      {row.operations.length === 0
                        ? '-'
                        : row.operations.map((o) => `${o.label} x${o.count}`).join('  ')}
                    </td>
                    <td className="dim">{row.names.join(' / ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 className="overlay-subhead">材料集計</h3>
            <table className="data-table">
              <thead>
                <tr>
                  <th>材質</th>
                  <th className="num">厚み</th>
                  <th className="num">枚数</th>
                  <th className="num">面積 (m2)</th>
                </tr>
              </thead>
              <tbody>
                {bom.materials.map((material) => (
                  <tr key={`${material.material}-${material.thickness}`}>
                    <td>{material.materialLabel}</td>
                    <td className="num">{material.thickness}</td>
                    <td className="num">{material.quantity}</td>
                    <td className="num">{material.areaM2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              同じ素材寸法かつ同じ加工の部材だけをまとめています。左右対称で穴位置が反転している部材は別の行になります。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
