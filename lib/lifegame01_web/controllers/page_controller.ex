defmodule Lifegame01Web.PageController do
  use Lifegame01Web, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
