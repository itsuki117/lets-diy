import { CircleCheck, Crosshair, TriangleAlert, X } from 'lucide-react';
import { focusOnParts } from '../../store/cameraCommands';
import { useEditorStore } from '../../store/useEditorStore';
import { useProjectStore } from '../../store/useProjectStore';

/**
 * 干渉チェックの結果。
 *
 * 判定は部材の外形（切断を反映した OBB）どうしで行う。
 * 穴や切り欠きは外形を変えないので無視してよい。
 * 面スナップでぴったり接した箇所は干渉としない。
 */
export function InterferencePanel() {
  const result = useEditorStore((s) => s.interference);
  const setResult = useEditorStore((s) => s.setInterference);
  const select = useEditorStore((s) => s.select);
  const parts = useProjectStore((s) => s.project.parts);

  if (!result) return null;
  const nameOf = (id: string): string => parts.find((p) => p.id === id)?.name ?? '(削除済み)';

  return (
    <div className="overlay-panel" role="dialog" aria-label="干渉チェック">
      <div className="overlay-head">
        <strong>干渉チェック</strong>
        <span className="muted">
          {result.length === 0 ? '干渉はありません' : `${result.length} 組が重なっています`}
        </span>
        <button type="button" className="icon-btn" title="閉じる" aria-label="閉じる" onClick={() => setResult(null)}>
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className="overlay-body">
        {result.length === 0 ? (
          <p className="notice notice-ok">
            <CircleCheck size={15} aria-hidden />
            部材どうしの食い込みは見つかりませんでした。面がぴったり接しているだけの箇所は干渉としません。
          </p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>部材</th>
                  <th>相手</th>
                  <th className="num">食い込み (mm)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {result.map((pair) => (
                  <tr key={`${pair.a}-${pair.b}`}>
                    <td>{nameOf(pair.a)}</td>
                    <td>{nameOf(pair.b)}</td>
                    <td className="num">{pair.depthMm}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="icon-btn"
                        title="この 2 つを選んで表示"
                        aria-label="この 2 つを選んで表示"
                        onClick={() => {
                          select([pair.a, pair.b]);
                          focusOnParts([pair.a, pair.b]);
                        }}
                      >
                        <Crosshair size={14} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="notice notice-warning">
              <TriangleAlert size={14} aria-hidden />
              判定は部材の外形（切断を反映）どうしで行います。穴や切り欠きの内側までは見ていません。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
