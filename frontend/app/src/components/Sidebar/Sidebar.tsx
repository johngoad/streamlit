/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { PureComponent, ReactElement, ReactNode } from "react"
import { ChevronRight, Close } from "@emotion-icons/material-outlined"
import { withTheme } from "@emotion/react"
import { Resizable } from "re-resizable"

import {
  Icon,
  BaseButton,
  BaseButtonKind,
  EmotionTheme,
  localStorageAvailable,
  StreamlitEndpoints,
  IsSidebarContext,
  isEmbed,
  isColoredLineDisplayed,
  IAppPage,
  PageConfig,
  Logo,
} from "@streamlit/lib"

import {
  StyledSidebar,
  StyledSidebarContent,
  StyledSidebarUserContent,
  StyledResizeHandle,
  StyledSidebarHeaderContainer,
  StyledCollapseSidebarButton,
  StyledSidebarOpenContainer,
  StyledOpenSidebarButton,
  StyledLogo,
  StyledNoLogoSpacer,
  StyledLogoLink,
} from "./styled-components"
import SidebarNav from "./SidebarNav"

export interface SidebarProps {
  endpoints: StreamlitEndpoints
  chevronDownshift: number
  children?: ReactElement
  initialSidebarState?: PageConfig.SidebarState
  theme: EmotionTheme
  hasElements: boolean
  appLogo: Logo | null
  appPages: IAppPage[]
  onPageChange: (pageName: string) => void
  currentPageScriptHash: string
  hideSidebarNav: boolean
}

interface State {
  collapsedSidebar: boolean
  sidebarWidth: string
  lastInnerWidth: number

  // When hovering the nav
  hideScrollbar: boolean
}

class Sidebar extends PureComponent<SidebarProps, State> {
  private mediumBreakpointPx: number

  static readonly minWidth = "336"

  public static calculateMaxBreakpoint(value: string): number {
    // We subtract a margin of 0.02 to use as a max-width
    return parseInt(value, 10) - 0.02
  }

  private sidebarRef = React.createRef<HTMLDivElement>()

  constructor(props: SidebarProps) {
    super(props)
    this.mediumBreakpointPx = Sidebar.calculateMaxBreakpoint(
      props.theme.breakpoints.md
    )

    const cachedSidebarWidth = localStorageAvailable()
      ? localStorage.getItem("sidebarWidth")
      : undefined

    this.state = {
      collapsedSidebar: Sidebar.shouldCollapse(props, this.mediumBreakpointPx),
      sidebarWidth: cachedSidebarWidth || Sidebar.minWidth,
      lastInnerWidth: window ? window.innerWidth : Infinity,
      hideScrollbar: false,
    }
  }

  componentDidUpdate(prevProps: any): void {
    this.mediumBreakpointPx = Sidebar.calculateMaxBreakpoint(
      this.props.theme.breakpoints.md
    )
    // Immediately expand/collapse sidebar when initialSidebarState or hasElements changes
    if (
      this.props.initialSidebarState !== prevProps.initialSidebarState ||
      this.props.hasElements !== prevProps.hasElements
    ) {
      this.setState({
        collapsedSidebar: Sidebar.shouldCollapse(
          this.props,
          this.mediumBreakpointPx
        ),
      })
    }
  }

  static shouldCollapse(
    props: SidebarProps,
    mediumBreakpointPx: number
  ): boolean {
    switch (props.initialSidebarState) {
      case PageConfig.SidebarState.EXPANDED:
        return false
      case PageConfig.SidebarState.COLLAPSED:
        return true
      case PageConfig.SidebarState.AUTO:
      default: {
        // Expand sidebar only if browser width > MEDIUM_BREAKPOINT_PX
        const { innerWidth } = window || {}
        return innerWidth ? innerWidth <= mediumBreakpointPx : false
      }
    }
  }

  componentDidMount(): void {
    window.addEventListener("resize", this.checkMobileOnResize)
    document.addEventListener("mousedown", this.handleClickOutside)
  }

  componentWillUnmount(): void {
    window.removeEventListener("resize", this.checkMobileOnResize)
    document.removeEventListener("mousedown", this.handleClickOutside)
  }

  handleClickOutside = (event: any): void => {
    if (this.sidebarRef && window) {
      const { current } = this.sidebarRef
      const { innerWidth } = window

      if (
        current &&
        !current.contains(event.target) &&
        innerWidth <= this.mediumBreakpointPx
      ) {
        this.setState({ collapsedSidebar: true })
      }
    }
  }

  setSidebarWidth = (width: number): void => {
    const newWidth = width.toString()

    this.setState({ sidebarWidth: newWidth })

    if (localStorageAvailable()) {
      window.localStorage.setItem("sidebarWidth", newWidth)
    }
  }

  resetSidebarWidth = (event: any): void => {
    // Double clicking on the resize handle resets sidebar to default width
    if (event.detail === 2) {
      this.setState({ sidebarWidth: Sidebar.minWidth })
      if (localStorageAvailable()) {
        window.localStorage.setItem("sidebarWidth", Sidebar.minWidth)
      }
    }
  }

  checkMobileOnResize = (): boolean => {
    if (!window) return false

    const { innerWidth } = window

    // Collapse the sidebar if the window was narrowed and is now mobile-sized
    if (
      innerWidth < this.state.lastInnerWidth &&
      innerWidth <= this.mediumBreakpointPx
    ) {
      this.setState({ collapsedSidebar: true })
    }
    this.setState({ lastInnerWidth: innerWidth })

    return true
  }

  toggleCollapse = (): void => {
    const { collapsedSidebar } = this.state

    this.setState({ collapsedSidebar: !collapsedSidebar })
  }

  hideScrollbar = (newValue: boolean): void => {
    this.setState({ hideScrollbar: newValue })
  }

  // Additional safeguard for sidebar height sizing
  headerDecorationVisible(): boolean {
    let coloredLineExists = false
    const headerDecoration = document.getElementById("stDecoration")
    if (headerDecoration) {
      const decorationStyles = window.getComputedStyle(headerDecoration)
      coloredLineExists =
        decorationStyles.visibility !== "hidden" &&
        decorationStyles.visibility !== "collapse" &&
        decorationStyles.display !== "none"
    }
    return coloredLineExists
  }

  renderLogo(collapsed: boolean): ReactElement {
    const { appLogo } = this.props

    if (!appLogo) {
      return <StyledNoLogoSpacer data-testid="stLogoSpacer" />
    }

    const displayImage =
      collapsed && appLogo.iconImage ? appLogo.iconImage : appLogo.image
    const source = this.props.endpoints.buildMediaURL(displayImage)
    if (appLogo.link) {
      return (
        <StyledLogoLink
          href={appLogo.link}
          target="_blank"
          rel="noreferrer"
          data-testid="stLogoLink"
        >
          <StyledLogo src={source} alt="Logo" data-testid="stLogo" />
        </StyledLogoLink>
      )
    }
    return <StyledLogo src={source} alt="Logo" data-testid="stLogo" />
  }

  public render(): ReactNode {
    const { collapsedSidebar, sidebarWidth, hideScrollbar } = this.state
    const {
      appPages,
      chevronDownshift,
      children,
      hasElements,
      onPageChange,
      currentPageScriptHash,
      hideSidebarNav,
    } = this.props

    // Handles checking the URL params
    const isEmbedded = isEmbed() && !isColoredLineDisplayed()
    // If header decoration visible, move sidebar down so decoration doesn't go below it
    const sidebarAdjust = !isEmbedded && this.headerDecorationVisible()

    // The tabindex is required to support scrolling by arrow keys.
    return (
      <>
        {collapsedSidebar && (
          <StyledSidebarOpenContainer
            chevronDownshift={chevronDownshift}
            isCollapsed={collapsedSidebar}
            data-testid="collapsedControl"
          >
            {this.renderLogo(true)}
            <StyledOpenSidebarButton>
              <BaseButton
                kind={BaseButtonKind.HEADER_NO_PADDING}
                onClick={this.toggleCollapse}
              >
                <Icon content={ChevronRight} size="xl" />
              </BaseButton>
            </StyledOpenSidebarButton>
          </StyledSidebarOpenContainer>
        )}
        <Resizable
          data-testid="stSidebar"
          aria-expanded={!collapsedSidebar}
          enable={{
            top: false,
            right: true,
            bottom: false,
            left: false,
          }}
          handleStyles={{ right: { width: "8px", right: "-6px" } }}
          handleComponent={{
            right: <StyledResizeHandle onClick={this.resetSidebarWidth} />,
          }}
          size={{
            width: sidebarWidth,
            // Addresses height glitch when anchor used - issue #6264
            height: sidebarAdjust ? window.innerHeight - 2 : "100%",
          }}
          as={StyledSidebar}
          onResizeStop={(e, direction, ref, d) => {
            const newWidth = parseInt(sidebarWidth, 10) + d.width
            this.setSidebarWidth(newWidth)
          }}
          // Props part of StyledSidebar, but not Resizable component
          // @ts-expect-error
          isCollapsed={collapsedSidebar}
          adjustTop={sidebarAdjust}
          sidebarWidth={sidebarWidth}
        >
          <StyledSidebarContent
            data-testid="stSidebarContent"
            hideScrollbar={hideScrollbar}
            ref={this.sidebarRef}
          >
            <StyledSidebarHeaderContainer data-testid="stSidebarHeader">
              {this.renderLogo(false)}
              <StyledCollapseSidebarButton data-testid="stSidebarCollapseButton">
                <BaseButton
                  kind={BaseButtonKind.HEADER_BUTTON}
                  onClick={this.toggleCollapse}
                >
                  <Icon content={Close} size="lg" />
                </BaseButton>
              </StyledCollapseSidebarButton>
            </StyledSidebarHeaderContainer>
            {!hideSidebarNav && (
              <SidebarNav
                endpoints={this.props.endpoints}
                appPages={appPages}
                collapseSidebar={this.toggleCollapse}
                currentPageScriptHash={currentPageScriptHash}
                hasSidebarElements={hasElements}
                hideParentScrollbar={this.hideScrollbar}
                onPageChange={onPageChange}
              />
            )}
            <StyledSidebarUserContent data-testid="stSidebarUserContent">
              {children}
            </StyledSidebarUserContent>
          </StyledSidebarContent>
        </Resizable>
      </>
    )
  }
}

function SidebarWithProvider(props: SidebarProps): ReactElement {
  return (
    <IsSidebarContext.Provider value={true}>
      <Sidebar {...props} />
    </IsSidebarContext.Provider>
  )
}

export default withTheme(SidebarWithProvider)
