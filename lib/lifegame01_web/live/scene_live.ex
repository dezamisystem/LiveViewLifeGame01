defmodule Lifegame01Web.SceneLive do
  # LiveViewインポート
  use Lifegame01Web, :live_view

  # three_scene.jsへのマウント
  @spec mount(any(), any(), map()) :: {:ok, map()}
  def mount(_params, _session, socket) do
    # 初期配置
    cells = init_cells()
    # 初期値登録
    socket =
      socket
      |> assign(cells: cells)
      |> assign(fps: 0)
      |> send_cell_count(get_width(), get_height())
      |> send_cell_alive_map(cells)

    # ワーキングプロセス開始
    Process.send_after(self(), :main_loop, 1000)

    # 返す
    {:ok, socket}
  end

  # ---- ヘルパー ----

  # ワーキングプロセス
  @spec handle_info(:main_loop, map()) :: {:noreply, map()}
  def handle_info(:main_loop, socket) do
    Process.send_after(self(), :main_loop, 250)
    {:noreply, main_loop(socket)}
  end

  # FPS表示更新
  @spec handle_event(<<_::72>>, map(), map()) :: {:noreply, map()}
  def handle_event("updateFps", %{"fps" => fps}, socket) do
    socket =
      socket
      |> assign(fps: fps)

    {:noreply, socket}
  end

  # セルの縦横個数を送信
  @spec send_cell_count(map(), integer(), integer()) :: map()
  def send_cell_count(socket, w, h) do
    push_event(socket, "sendCellCount", %{w: w, h: h})
  end

  # セルの生死状態マップを送信
  @spec send_cell_alive_map(map(), map()) :: map()
  def send_cell_alive_map(socket, cells) do
    js_cells =
      cells
      |> Enum.map(fn {{x, y}, v} ->
        {"#{x},#{y}", v}
      end)
      |> Enum.into(%{})

    push_event(socket, "sendCellAliveMap", %{cells: js_cells})
  end

  # ---- ゲームロジック ----

  # 横幅
  def get_width() do
    21
  end

  # 縦幅
  def get_height() do
    21
  end

  # 生きているセルの隣接するセルの数を数える
  @spec count_alive_neighbors({integer(), integer()}, map()) :: integer()
  defp count_alive_neighbors({x, y}, cells) do
    for dy <- -1..1, dx <- -1..1, {dx, dy} != {0, 0} do
      neighbor_x = x + dx
      neighbor_y = y + dy
      # 存在チェック
      if Map.has_key?(cells, {neighbor_x, neighbor_y}) do
        if cells[{neighbor_x, neighbor_y}], do: 1, else: 0
      else
        0
      end
    end
    |> Enum.sum()
  end

  # 生存：生きているセルに隣接する生きたセルが2つかまたは3つあれば、生存維持
  # 過疎or過密：上記の条件を満たさない場合は、次の世代で死滅する
  # 誕生：死んでいるセルに隣接する生きたセルがちょうど3つあれば、次の世代で誕生する
  # 過疎or過密：上記の条件を満たさない場合は、次の世代で死滅する
  @spec rule(boolean(), integer()) :: boolean()
  defp rule(true, alive_neighbors) when alive_neighbors in 2..3, do: true
  defp rule(true, _), do: false
  defp rule(false, 3), do: true
  defp rule(false, _), do: false

  @doc """
  Map型のデータを並列処理して更新する一般項
  """
  @spec parallel_update_map(map(), (any() -> any())) :: map()
  def parallel_update_map(map, fun) do
    map
    |> Task.async_stream(fun)
    |> Enum.into(%{}, fn {:ok, {k, v}} -> {k, v} end)
  end

  @doc """
  レイアウトデータをマップに変換する
  """
  @spec get_layout_map(integer(), integer(), list(list(integer()))) :: map()
  def get_layout_map(w, h, layout_matrix) do
    layout_height = length(layout_matrix)
    layout_width = length(hd(layout_matrix))
    # 配置は中央を基準にする
    start_x = if w >= layout_width, do: div(w - layout_width, 2), else: 0
    start_y = if h >= layout_height, do: div(h - layout_height, 2), else: 0
    # 配列からマップを生成
    for x <- 0..(layout_width - 1), y <- 0..(layout_height - 1), into: %{} do
      {{x + start_x, y + start_y}, Enum.at(Enum.at(layout_matrix, x), y) > 0}
    end
  end

  # セル群を生成
  @spec create_cells(integer(), integer(), map()) :: map()
  def create_cells(w, h, layout_map) do
    for x <- 0..(w - 1), y <- 0..(h - 1), into: %{} do
      if Map.has_key?(layout_map, {x, y}) do
        {{x, y}, layout_map[{x, y}]}
      else
        {{x, y}, false}
      end
    end
  end

  # ---- メイン ----

  # 銀河配置
  defp get_galaxy_matrix_layout() do
    [
      [1, 1, 0, 1, 1, 1, 1, 1, 1],
      [1, 1, 0, 1, 1, 1, 1, 1, 1],
      [1, 1, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 0, 0, 0, 0, 1, 1],
      [1, 1, 0, 0, 0, 0, 0, 1, 1],
      [1, 1, 0, 0, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 0, 1, 1]
    ]
  end

  # 初期セル群
  def init_cells() do
    create_cells(
      get_width(),
      get_height(),
      get_layout_map(get_width(), get_height(), get_galaxy_matrix_layout())
    )
  end

  # 次世代
  def next_generation_cells(cells) do
    parallel_update_map(cells, fn {pos, _v} ->
      {pos, rule(cells[pos], count_alive_neighbors(pos, cells))}
    end)
  end

  # メインループ
  @spec main_loop(map()) :: map()
  def main_loop(socket) do
    new_cells = next_generation_cells(socket.assigns.cells)

    socket
    |> assign(cells: new_cells)
    |> send_cell_alive_map(new_cells)
  end

  # HTMLレンダリング
  def render(assigns) do
    ~H"""
    <div class="relative w-screen h-screen overflow-hidden bg-black">
      <label class="absolute top-4 left-4 z-10 text-white font-mono bg-black/50 px-2 py-1 rounded pointer-events-none">
        FPS: {@fps}
      </label>
      <div
        id="three-scene-container"
        phx-hook="ThreeScene"
        phx-update="ignore"
        class="absolute inset-0"
      >
        <%!-- Canvas will be injected here by the hook --%>
      </div>
    </div>
    """
  end
end
