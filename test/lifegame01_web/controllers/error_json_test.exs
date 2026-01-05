defmodule Lifegame01Web.ErrorJSONTest do
  use Lifegame01Web.ConnCase, async: true

  test "renders 404" do
    assert Lifegame01Web.ErrorJSON.render("404.json", %{}) == %{errors: %{detail: "Not Found"}}
  end

  test "renders 500" do
    assert Lifegame01Web.ErrorJSON.render("500.json", %{}) ==
             %{errors: %{detail: "Internal Server Error"}}
  end
end
